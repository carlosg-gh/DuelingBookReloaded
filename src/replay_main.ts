/**
 * Replay controls — runs in the PAGE (MAIN) world on duelingbook.com/replay
 * pages only (see manifest.json), because the replay engine's state lives
 * in page globals the isolated world can't touch.
 *
 * DuelingBook's replay driver is an unobfuscated inline script: `timer`
 * (500ms tick → `timerE()` advances `seconds` and executes due plays from
 * `replay_arr`), and — after every action — a full board snapshot pushed
 * to `GAMESTATES` by the page's `saveGamestate` (which `restoreGamestate`
 * can re-apply). The page even ships a hidden "Step Backward" button whose
 * implementation assumes two snapshots per play (it doesn't hold — that's
 * likely why it's disabled); we record our own play→snapshot mapping
 * instead. See docs/duelingbook-internals.md.
 *
 * Everything here feature-detects: if DuelingBook renames these globals,
 * the controls simply never appear (never throw — an exception here would
 * be a page-world error on someone else's site).
 *
 * Commands arrive from the isolated-world content script (hotkeys, the
 * options toggle) via window.postMessage; the bar's own buttons call the
 * same handlers directly.
 */

import {
  buildEventMarkers,
  buildTimeline,
  EventKind,
  formatSeconds,
  fractionForSeconds,
  indexForSeconds,
  markerAfter,
  markerBefore,
  nextSpeed,
  prevSpeed,
  previousInterestingIndex,
  ReplayPlay,
  secondsForFraction,
  TimelineModel,
} from "./utilities/replayTimeline";

/* eslint-disable @typescript-eslint/no-explicit-any */
const W = window as any;

// DuelingBook's native tick intervals (playE/fastE reset timer.millis to
// these; we re-divide by the chosen speed whenever they do).
const NORMAL_MILLIS = 500;
const FAST_MILLIS = 150;
// While seeking forward we crank both the tick and the animation clock.
const SEEK_MILLIS = 25;
const SEEK_TIME_SCALE = 25;
const UI_TICK_MS = 200;

const LABEL_FOR_STATUS: Record<string, string> = {
  Dueling: "duel_start",
  Siding: "siding",
  RPS: "rps_start",
  "Pick First": "tp_start",
};

interface SnapshotRef {
  /** Index into fullPlays of the next play to run when this was saved. */
  playIndex: number;
  gsIndex: number;
}

let enabled = true;
let initialized = false;
let fullPlays: ReplayPlay[] = [];
let timeline: TimelineModel | null = null;
let snapMap: SnapshotRef[] = [];
let userSpeed = 1;
let seek: { target: number; resume: boolean } | null = null;
let uiTimer: number | undefined;
let seekPump: number | undefined;
let mutedPlaySound: unknown = null;
let clampedSetTimeout: typeof window.setTimeout | null = null;
let seekProgress = { index: -1, seconds: -1, at: 0 };

function engineReady(): boolean {
  return (
    Array.isArray(W.replay_arr) &&
    Array.isArray(W.previous_plays) &&
    Array.isArray(W.GAMESTATES) &&
    Array.isArray(W.actionsQueue) &&
    typeof W.restoreGamestate === "function" &&
    typeof W.saveGamestate === "function" &&
    typeof W.playE === "function" &&
    typeof W.pauseE === "function" &&
    typeof W.gotoDuel === "function" &&
    typeof W.TweenMax?.globalTimeScale === "function" &&
    W.timer &&
    typeof W.timer.millis === "number" &&
    W.replay === true
  );
}

/** replay_arr only ever shrinks from the front, so it is a suffix of
 * fullPlays and the next play's index is derivable from lengths alone. */
function currentIndex(): number {
  return Math.max(0, fullPlays.length - W.replay_arr.length);
}

function currentSeconds(): number {
  return typeof W.seconds === "number" ? W.seconds : 0;
}

function isPlaying(): boolean {
  return W.timer.active === true && W.paused !== true;
}

// ── Speed ──────────────────────────────────────────────────────────────

function expectedMillis(): number {
  return Math.max(
    16,
    Math.round((W.fast_forwarding ? FAST_MILLIS : NORMAL_MILLIS) / userSpeed),
  );
}

/** playE/fastE reset timer.millis; instead of wrapping them (the native
 * buttons hold direct references), the UI tick re-applies the divided
 * value whenever it drifts. Only touch the timer on a mismatch — reset()
 * restarts the interval, and doing that every tick would starve it. */
function enforceSpeed(): void {
  if (seek) return;
  const millis = expectedMillis();
  if (W.timer.millis !== millis) {
    W.timer.millis = millis;
    if (W.timer.active) {
      W.timer.reset();
      W.timer.start();
    }
  }
}

function setSpeed(speed: number): void {
  userSpeed = speed;
  if (!seek) W.TweenMax.globalTimeScale(speed);
  enforceSpeed();
  render();
}

// ── Playback ───────────────────────────────────────────────────────────

function playPause(): void {
  if (seek) return;
  if (isPlaying()) W.pauseE();
  else W.playE();
  render();
}

function nextPlay(): void {
  if (seek) return;
  if (typeof W.nextE === "function") W.nextE();
}

// ── Jumping ────────────────────────────────────────────────────────────

/** Complete in-flight card animations so a restore doesn't fight them
 * and seeks aren't paced by tween time. Not the page's own
 * getAllActiveTweens() — that one crashes in its debug logging when no
 * ".all_good" element is on screen. Skipped: infinite tweens (the
 * "all good" pulse has no completion to snap to) and DB's side-panel
 * animations (watchers/chat/log) — force-completing those at seek
 * frequency fires their onCompletes against half-initialized scrollbar
 * objects and the resulting throws can jam the action queue. Only board
 * tweens gate endAction anyway. */
const PANEL_SELECTOR = "#watchers, #watch_chat, #duel_log, .cout_txt, .cin";
function finishActiveTweens(): void {
  let tweens: any[] = [];
  try {
    tweens = W.TweenMax.getAllTweens() ?? [];
  } catch {
    return;
  }
  for (const tween of tweens) {
    try {
      if (typeof tween.repeat === "function" && tween.repeat() === -1) continue;
      const el = tween.target?.[0];
      if (el?.classList?.contains("all_good")) continue;
      if (el instanceof Element && el.closest(PANEL_SELECTOR)) continue;
      tween.totalProgress(1);
    } catch {
      // a tween whose target died mid-flight — nothing to finish
    }
  }
}

/**
 * Game 1's opening hands are dealt by intro *actions*, not by replayable
 * plays — a snapshot taken before the deal (empty hands on the RPS/pick
 * screens) can never be a rewind target: replaying from it re-runs no
 * deal, and the first play that touches a hand card crashes duel.js and
 * jams the action queue.
 */
function isUsableGamestate(gamestate: any): boolean {
  if (!gamestate) return false;
  if (
    (gamestate.status === "Pick First" || gamestate.status === "RPS") &&
    gamestate.player1?.hand?.length === 0 &&
    gamestate.player2?.hand?.length === 0
  ) {
    return false;
  }
  return true;
}

/**
 * duel.js actions release the queue through a mix of tweens and real
 * setTimeouts (350–1000ms); tween-snapping alone leaves seeks paced by
 * those timeouts (~9 plays/s). Clamping short delays to 0 for the
 * duration of a seek measured 3.3× faster overall. Only sub-1.5s delays
 * are touched — anything longer is someone's real timer, not a DB action
 * beat — and the clamp is removed the moment the seek ends.
 */
function installTimeoutClamp(): void {
  if (clampedSetTimeout) return;
  const original = W.setTimeout;
  clampedSetTimeout = original;
  W.setTimeout = function (
    handler: TimerHandler,
    delay?: number,
    ...args: unknown[]
  ) {
    const clamped =
      typeof delay === "number" && delay > 0 && delay <= 1500 ? 0 : delay;
    return original.call(W, handler, clamped, ...args);
  };
}

function removeTimeoutClamp(): void {
  if (clampedSetTimeout) {
    W.setTimeout = clampedSetTimeout;
    clampedSetTimeout = null;
  }
}

function latestSnapshotAtOrBefore(playIndex: number): SnapshotRef | null {
  for (let i = snapMap.length - 1; i >= 0; i--) {
    if (
      snapMap[i].playIndex <= playIndex &&
      isUsableGamestate(W.GAMESTATES[snapMap[i].gsIndex])
    )
      return snapMap[i];
  }
  return null;
}

/** Earliest rewindable point; latest save wins among equal cursors. */
function earliestUsableSnapshot(): SnapshotRef | null {
  let best: SnapshotRef | null = null;
  for (const ref of snapMap) {
    if (!isUsableGamestate(W.GAMESTATES[ref.gsIndex])) continue;
    if (!best || ref.playIndex <= best.playIndex) best = ref;
  }
  return best;
}

/** Card-front data per duel-card id, harvested from the play list (each
 * summon/activation play carries its card's full data) — the face for a
 * resurrected card. Face-down cards never appear here and don't need to. */
const cardDataById = new Map<unknown, unknown>();

/**
 * A snapshot taken mid-action (fast seeks capture between queue steps)
 * can hold null entries in the ordered card lists. The field list is
 * positional — 16 zone slots where null means "empty zone" — but a null
 * in hand/main/grave/banished/extra crashes the restore path (initHand /
 * shiftDecks tween whole arrays, removeFromHand dereferences entries).
 * Drop them, at save time and again before restoring older snapshots.
 */
function sanitizeGamestate(gamestate: any): void {
  for (const pk of ["player1", "player2", "player3", "player4"]) {
    const data = gamestate?.[pk];
    if (!data) continue;
    for (const key of ["hand", "main", "grave", "banished", "extra"]) {
      if (Array.isArray(data[key])) {
        data[key] = data[key].filter((entry: unknown) => entry != null);
      }
    }
  }
}

/** Slot harvested card-front data into every snapshot entry that lacks
 * it, so a resurrected card gets its real face through initCard's native
 * `entry.data` path (initializeFromData, token pics, face-up rotation). */
function injectCardData(gamestate: any): void {
  for (const pk of ["player1", "player2", "player3", "player4"]) {
    const data = gamestate?.[pk];
    if (!data) continue;
    for (const key of ["field", "hand", "main", "grave", "banished", "extra"]) {
      for (const entry of data[key] ?? []) {
        if (!entry) continue;
        for (const cardEntry of [entry, ...(entry.xyz_arr ?? [])]) {
          if (cardEntry?.id != null && !cardEntry.data) {
            const cardData = cardDataById.get(cardEntry.id);
            if (cardData) cardEntry.data = cardData;
          }
        }
      }
    }
  }
}

function jumpBackTo(playIndex: number): void {
  const snap = latestSnapshotAtOrBefore(playIndex) ?? earliestUsableSnapshot();
  if (!snap) return;
  const gamestate = W.GAMESTATES[snap.gsIndex];
  if (!gamestate) return;

  const resume = isPlaying() && !seek;
  seek = null;
  window.clearInterval(seekPump);
  seekPump = undefined;
  removeTimeoutClamp();
  if (mutedPlaySound !== null) {
    W.playSound = mutedPlaySound;
    mutedPlaySound = null;
  }
  W.pauseE();
  finishActiveTweens();
  W.actionsQueue.length = 0;
  W.stopQueue = false;
  W.skipping = false;
  W.fast_forwarding = false;

  // restoreGamestate rebuilds cards/LP/phase but not the screen or the
  // turn bookkeeping — bring those along ourselves.
  const label = LABEL_FOR_STATUS[gamestate.status] ?? "duel_start";
  if (typeof W.currentLabel === "string" && !W.currentLabel.startsWith(label)) {
    W.gotoDuel(label);
  }
  if (gamestate.turnCount !== undefined) W.turnCount = gamestate.turnCount;
  if (gamestate.turn_player && W.player1 && W.player2) {
    W.turn_player =
      gamestate.turn_player === W.player1.username ? W.player1 : W.player2;
  }

  W.replay_arr = fullPlays.slice(snap.playIndex);
  W.previous_plays = fullPlays.slice(0, snap.playIndex);
  W.seconds =
    (fullPlays[snap.playIndex]?.seconds ?? currentSeconds()) - 0.5;
  W.GAMESTATES.length = snap.gsIndex + 1;
  snapMap = snapMap.filter((ref) => ref.gsIndex <= snap.gsIndex);

  sanitizeGamestate(gamestate);
  injectCardData(gamestate);
  W.restoreGamestate(gamestate);
  // Belt and braces: if the restore still threw somewhere, `resetting`
  // stays true and endAction is dead — unstick it instead of freezing.
  window.setTimeout(() => {
    if (W.resetting === true) {
      console.warn("[DBR] restore left resetting stuck — clearing");
      W.resetting = false;
      W.stopQueue = false;
    }
  }, 1500);
  if (resume) {
    // give the restore tween (350ms) room before the queue advances
    window.setTimeout(() => {
      if (!seek) W.playE();
    }, 500);
  }
  render();
}

/** Forward jumps have no snapshots to restore — fast-replay through the
 * intervening plays using the engine's own skip machinery (`skipping`
 * keeps timerE's fast-forward loop running even while animations are in
 * flight), with the animation clock cranked so it lands quickly. */
function seekForwardTo(targetSeconds: number): void {
  if (seek) {
    seek.target = targetSeconds;
    W.gotoSeconds = targetSeconds;
    return;
  }
  seek = { target: targetSeconds, resume: isPlaying() };
  W.gotoSeconds = targetSeconds;
  W.skipping = true;
  W.fast_forwarding = true;
  W.paused = false;
  W.TweenMax.globalTimeScale(SEEK_TIME_SCALE);
  W.timer.millis = SEEK_MILLIS;
  W.timer.reset();
  W.timer.start();
  // Seeks are queue-bound: each play's actions release the queue when
  // their animations complete, so snapping board tweens at high frequency
  // (not just on the UI tick) is what actually sets the seek speed. Sound
  // is muted for the duration — hundreds of plays per second otherwise
  // stack hundreds of overlapping effects.
  if (typeof W.playSound === "function" && mutedPlaySound === null) {
    mutedPlaySound = W.playSound;
    W.playSound = () => {};
  }
  installTimeoutClamp();
  seekProgress = { index: currentIndex(), seconds: currentSeconds(), at: Date.now() };
  window.clearInterval(seekPump);
  seekPump = window.setInterval(finishActiveTweens, 10);
  render();
}

function finishSeek(): void {
  if (!seek) return;
  const resume = seek.resume;
  seek = null;
  window.clearInterval(seekPump);
  seekPump = undefined;
  removeTimeoutClamp();
  if (mutedPlaySound !== null) {
    W.playSound = mutedPlaySound;
    mutedPlaySound = null;
  }
  W.fast_forwarding = false;
  W.skipping = false;
  W.gotoSeconds = 0;
  W.TweenMax.globalTimeScale(userSpeed);
  if (resume) W.playE();
  else W.pauseE();
  enforceSpeed();
  render();
}

function jumpToSeconds(target: number): void {
  if (!timeline) return;
  if (target < currentSeconds()) {
    jumpBackTo(indexForSeconds(fullPlays, target));
  } else {
    seekForwardTo(target);
  }
}

function stepBackward(): void {
  const index = previousInterestingIndex(fullPlays, currentIndex());
  if (index < 0) return;
  // stepping is an inspection gesture — always land paused
  W.pauseE();
  jumpBackTo(index);
}

function jumpToGame(game: number): void {
  const marker = timeline?.games[game - 1];
  if (!marker) return;
  if (marker.index < currentIndex()) jumpBackTo(marker.index);
  else seekForwardTo(marker.seconds);
}

function prevTurn(): void {
  if (!timeline) return;
  const marker = markerBefore(timeline.turns, currentIndex());
  if (marker) jumpBackTo(marker.index);
}

function nextTurn(): void {
  if (!timeline) return;
  const marker = markerAfter(timeline.turns, currentIndex());
  if (marker) seekForwardTo(marker.seconds);
}

// ── UI ─────────────────────────────────────────────────────────────────
// Vanilla DOM, divs only (no focusable elements — focus must never leave
// the page, and a focused <button> would re-fire on the space hotkey).

let bar: HTMLDivElement | null = null;
let fillEl: HTMLDivElement | null = null;
let handleEl: HTMLDivElement | null = null;
let timeEl: HTMLDivElement | null = null;
let speedEl: HTMLDivElement | null = null;
let playPauseEl: HTMLDivElement | null = null;
let tooltipEl: HTMLDivElement | null = null;
let trackEl: HTMLDivElement | null = null;
let nativePrev: HTMLDivElement | null = null;
let nativeNext: HTMLDivElement | null = null;
let hiddenNextProxy: any = null;

function button(
  className: string,
  text: string,
  title: string,
  onClick: () => void,
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `dbr-rb-btn ${className}`;
  el.textContent = text;
  el.title = title;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return el;
}

function trackFraction(e: MouseEvent): number {
  const rect = trackEl!.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
}

function tooltipTextAt(seconds: number): string {
  if (!timeline) return "";
  const index = indexForSeconds(fullPlays, seconds);
  const turn = markerBefore(timeline.turns, index + 1);
  const game =
    timeline.games.length > 1 ? markerBefore(timeline.games, index + 1) : null;
  const parts = [formatSeconds(seconds - timeline.startSeconds)];
  if (game) parts.push(game.label);
  if (turn) parts.push(turn.label);
  return parts.join(" · ");
}

function showTooltip(fraction: number, text: string): void {
  if (!tooltipEl) return;
  tooltipEl.style.left = `${Math.min(0.97, Math.max(0.03, fraction)) * 100}%`;
  tooltipEl.textContent = text;
  tooltipEl.classList.add("dbr-rb-tooltip-visible");
}

function hideTooltip(): void {
  tooltipEl?.classList.remove("dbr-rb-tooltip-visible");
}

const EVENT_GLYPHS: Record<EventKind, string> = {
  summon: "▲",
  activation: "✦",
  attack: "⚔︎", // variation selector: text glyph, not emoji
  phase: "◆",
  lp: "♥",
};

/** Icon strip above the track: one glyph per notable play, hover for the
 * play's own duel-log line, click to jump there. */
function buildEventsStrip(): HTMLDivElement {
  const strip = document.createElement("div");
  strip.className = "dbr-rb-events";
  for (const marker of buildEventMarkers(fullPlays)) {
    const fraction = fractionForSeconds(timeline!, marker.seconds);
    const icon = document.createElement("div");
    icon.className = `dbr-rb-event dbr-rb-ev-${marker.kind}`;
    icon.textContent = EVENT_GLYPHS[marker.kind];
    icon.style.left = `${fraction * 100}%`;
    icon.addEventListener("mouseenter", () =>
      showTooltip(
        fraction,
        `${formatSeconds(marker.seconds - timeline!.startSeconds)} · ${marker.label}`,
      ),
    );
    icon.addEventListener("mouseleave", hideTooltip);
    icon.addEventListener("click", (e) => {
      e.stopPropagation();
      jumpToSeconds(marker.seconds);
    });
    strip.appendChild(icon);
  }
  return strip;
}

function buildBar(): void {
  if (bar || !timeline) return;
  bar = document.createElement("div");
  bar.id = "dbr-replay-bar";

  const controls = document.createElement("div");
  controls.className = "dbr-rb-controls";

  controls.appendChild(
    button("dbr-rb-step-back", "⏮", "Step Backward (←)", stepBackward),
  );
  playPauseEl = button("dbr-rb-play", "⏵", "Play/Pause (Space)", playPause);
  controls.appendChild(playPauseEl);
  controls.appendChild(
    button("dbr-rb-next", "⏭", "Next Play (→)", nextPlay),
  );

  const speedWrap = document.createElement("div");
  speedWrap.className = "dbr-rb-speed";
  speedWrap.appendChild(
    button("dbr-rb-slower", "−", "Slower (↓)", () =>
      setSpeed(prevSpeed(userSpeed)),
    ),
  );
  speedEl = document.createElement("div");
  speedEl.className = "dbr-rb-speed-val";
  speedEl.textContent = "1×";
  speedEl.title = "Playback speed";
  speedWrap.appendChild(speedEl);
  speedWrap.appendChild(
    button("dbr-rb-faster", "+", "Faster (↑)", () =>
      setSpeed(nextSpeed(userSpeed)),
    ),
  );
  controls.appendChild(speedWrap);

  if (timeline.games.length > 1) {
    const games = document.createElement("div");
    games.className = "dbr-rb-games";
    timeline.games.forEach((marker, i) => {
      games.appendChild(
        button(
          "dbr-rb-game",
          `G${i + 1}`,
          `Jump to ${marker.label}`,
          () => jumpToGame(i + 1),
        ),
      );
    });
    controls.appendChild(games);
  }

  timeEl = document.createElement("div");
  timeEl.className = "dbr-rb-time";
  controls.appendChild(timeEl);

  bar.appendChild(controls);

  const scrub = document.createElement("div");
  scrub.className = "dbr-rb-scrub";

  trackEl = document.createElement("div");
  trackEl.className = "dbr-rb-track";
  fillEl = document.createElement("div");
  fillEl.className = "dbr-rb-fill";
  trackEl.appendChild(fillEl);

  for (const marker of timeline.turns) {
    const tick = document.createElement("div");
    tick.className = "dbr-rb-marker dbr-rb-turn";
    tick.style.left = `${fractionForSeconds(timeline, marker.seconds) * 100}%`;
    tick.title = marker.label;
    trackEl.appendChild(tick);
  }
  for (const marker of timeline.games.slice(1)) {
    const tick = document.createElement("div");
    tick.className = "dbr-rb-marker dbr-rb-game-marker";
    tick.style.left = `${fractionForSeconds(timeline, marker.seconds) * 100}%`;
    tick.title = marker.label;
    trackEl.appendChild(tick);
  }

  handleEl = document.createElement("div");
  handleEl.className = "dbr-rb-handle";
  trackEl.appendChild(handleEl);

  tooltipEl = document.createElement("div");
  tooltipEl.className = "dbr-rb-tooltip";

  trackEl.addEventListener("mousemove", (e) => {
    if (!timeline) return;
    const fraction = trackFraction(e);
    showTooltip(fraction, tooltipTextAt(secondsForFraction(timeline, fraction)));
  });
  trackEl.addEventListener("mouseleave", hideTooltip);
  trackEl.addEventListener("mousedown", (e) => {
    if (!timeline) return;
    e.preventDefault();
    jumpToSeconds(secondsForFraction(timeline, trackFraction(e)));
  });

  scrub.appendChild(buildEventsStrip());
  scrub.appendChild(trackEl);
  scrub.appendChild(tooltipEl);
  bar.appendChild(scrub);
  document.body.appendChild(bar);

  installNativePrevNext();
}

/**
 * Native-looking Prev/Next pair in DuelingBook's own panel, replacing
 * their "Next Play" button (its slot: left 105 / top 590 in game units).
 * DB's panel buttons are invisible <input>s that take the clicks, each
 * mirrored by a ".button proxy" div for the visuals — and ".button" has
 * pointer-events: none, so our replacements get pointer-events re-enabled
 * in replay-controls.css and handle clicks themselves.
 */
function installNativePrevNext(): void {
  const duel = document.getElementById("duel");
  if (!duel || nativePrev) return;
  const nextInput = document.getElementById("next_btn");
  if (nextInput) {
    nextInput.style.display = "none";
    hiddenNextProxy = W.$?.("#next_btn")?.data("proxy") ?? null;
    hiddenNextProxy?.hide?.();
  }
  const makeButton = (
    id: string,
    text: string,
    title: string,
    onClick: () => void,
  ): HTMLDivElement => {
    const el = document.createElement("div");
    el.id = id;
    el.className = "button proxy unselectable";
    el.textContent = text;
    el.title = title;
    el.addEventListener("click", onClick);
    return el;
  };
  nativePrev = makeButton("dbr-prev-btn", "Prev", "Step Backward (←)", stepBackward);
  nativeNext = makeButton("dbr-next-btn", "Next", "Next Play (→)", nextPlay);
  duel.appendChild(nativePrev);
  duel.appendChild(nativeNext);
}

function removeUI(): void {
  bar?.remove();
  bar = null;
  nativePrev?.remove();
  nativePrev = null;
  nativeNext?.remove();
  nativeNext = null;
  const nextInput = document.getElementById("next_btn");
  if (nextInput) nextInput.style.display = "";
  hiddenNextProxy?.show?.();
  hiddenNextProxy = null;
}

function render(): void {
  if (!bar || !timeline) return;
  const seconds = currentSeconds();
  const fraction = fractionForSeconds(timeline, seconds);
  if (fillEl) fillEl.style.width = `${fraction * 100}%`;
  if (handleEl) handleEl.style.left = `${fraction * 100}%`;
  if (timeEl) {
    timeEl.textContent = `${formatSeconds(
      Math.min(seconds, timeline.endSeconds) - timeline.startSeconds,
    )} / ${formatSeconds(timeline.endSeconds - timeline.startSeconds)}`;
  }
  if (speedEl) {
    speedEl.textContent = `${userSpeed}×`;
  }
  if (playPauseEl) {
    playPauseEl.textContent = seek ? "…" : isPlaying() ? "⏸" : "⏵";
  }
  bar.classList.toggle("dbr-rb-seeking", seek !== null);
}

// ── Wiring ─────────────────────────────────────────────────────────────

function uiTick(): void {
  if (!initialized) return;
  if (
    seek &&
    (W.skipping !== true ||
      currentSeconds() >= seek.target ||
      W.replay_arr.length === 0)
  ) {
    finishSeek();
  } else if (seek) {
    // Watchdog: an action that never calls endAction (a duel.js throw, a
    // completion path we broke) freezes the whole engine. If a seek makes
    // no progress for 5s, abort it and restore the nearest snapshot —
    // jumpBackTo clears the jammed queue as a side effect.
    const index = currentIndex();
    const seconds = currentSeconds();
    if (index !== seekProgress.index || seconds !== seekProgress.seconds) {
      seekProgress = { index, seconds, at: Date.now() };
    } else if (Date.now() - seekProgress.at > 5000) {
      console.warn("[DBR] seek made no progress for 5s — recovering");
      finishSeek();
      jumpBackTo(index);
      return;
    }
  }
  enforceSpeed();
  render();
}

function instrument(): void {
  fullPlays = (W.previous_plays as ReplayPlay[]).concat(W.replay_arr);
  timeline = buildTimeline(fullPlays);

  // Faces for resurrected cards (below): plays carry their card's full
  // front data under the same duel-card id.
  for (const play of fullPlays as any[]) {
    if (play?.id != null && play.card) cardDataById.set(play.id, play.card);
  }

  // A snapshot can reference cards the live pools no longer hold: tokens
  // get destroyed, and siding removes sided-out cards entirely (their ids
  // appear in no card's prev_ids). duel.js's restore path breaks on
  // those: initCards does getDuelCard → null, initCard(null) throws
  // (stranding `resetting`, which blocks endAction and freezes the
  // engine), and initCards pushes its own null into the player's array
  // regardless of anything initCard might do — so the fix must make the
  // LOOKUP succeed. Wrap getDuelCard: during a restore, a miss gets a
  // fresh newDuelCard (recycled-bin or new — never a stolen live card)
  // for the list's owner, tracked via an initCards wrapper; the face
  // comes from injectCardData above through initCard's native
  // `entry.data` path.
  let initCardsPlayer: any = null;
  const origInitCards = W.initCards;
  if (typeof origInitCards === "function") {
    W.initCards = function (player: any, ...rest: unknown[]) {
      initCardsPlayer = player;
      try {
        return origInitCards.call(this, player, ...rest);
      } finally {
        initCardsPlayer = null;
      }
    };
  }
  const origGetDuelCard = W.getDuelCard;
  if (typeof origGetDuelCard === "function") {
    W.getDuelCard = function (id: unknown, ...rest: unknown[]) {
      const found = origGetDuelCard.call(this, id, ...rest);
      if (found || W.resetting !== true || !initCardsPlayer || id == null) {
        return found;
      }
      try {
        const card = W.newDuelCard(initCardsPlayer);
        card.data("id", id);
        card.data("prev_ids", []);
        return card;
      } catch (err) {
        console.warn("[DBR] could not resurrect card", id, err);
        return null;
      }
    };
  }

  // Second line of defense: any other throw inside initDuel would also
  // strand `resetting` — swallow it so the restore finishes degraded
  // rather than freezing everything.
  const origInitDuel = W.initDuel;
  if (typeof origInitDuel === "function") {
    W.initDuel = function (...args: unknown[]) {
      try {
        return origInitDuel.apply(this, args);
      } catch (err) {
        console.error("[DBR] initDuel failed during restore:", err);
      }
    };
  }

  // Record which play each snapshot belongs to. endAction() calls
  // saveGamestate() after every queued action (several per play), always
  // by global name, so wrapping the global is enough.
  const origSave = W.saveGamestate;
  W.saveGamestate = function (...args: unknown[]) {
    const result = origSave.apply(this, args);
    if (Array.isArray(W.GAMESTATES) && W.GAMESTATES.length > 0) {
      sanitizeGamestate(W.GAMESTATES[W.GAMESTATES.length - 1]);
      snapMap.push({
        playIndex: currentIndex(),
        gsIndex: W.GAMESTATES.length - 1,
      });
    }
    return result;
  };
  // Snapshots saved before we were injected (the intro actions) still
  // exist — anchor them to the start so early rewinds have a target. If
  // playback is somehow already far along (a late re-injection), their
  // true positions are unknowable: leave them unmapped rather than let a
  // rewind restore a mislabeled board.
  if (currentIndex() <= 2) {
    for (let i = 0; i < W.GAMESTATES.length; i++) {
      snapMap.push({ playIndex: 0, gsIndex: i });
    }
  }
}

const COMMANDS: Record<string, (arg?: number) => void> = {
  playPause,
  stepBackward,
  nextPlay,
  speedUp: () => setSpeed(nextSpeed(userSpeed)),
  speedDown: () => setSpeed(prevSpeed(userSpeed)),
  prevTurn,
  nextTurn,
  jumpGame: (arg) => {
    if (typeof arg === "number") jumpToGame(arg);
  },
};

window.addEventListener("message", (e: MessageEvent) => {
  if (e.source !== window || !e.data || typeof e.data !== "object") return;
  if (e.data.dbr === "replay-enable") {
    setEnabled(e.data.enabled !== false);
  } else if (e.data.dbr === "replay-command" && enabled && initialized) {
    COMMANDS[e.data.cmd]?.(e.data.arg);
  }
});

function setEnabled(value: boolean): void {
  enabled = value;
  if (!enabled) {
    if (seek) finishSeek();
    userSpeed = 1;
    if (initialized) {
      W.TweenMax.globalTimeScale(1);
      enforceSpeed();
    }
    removeUI();
  } else if (initialized) {
    buildBar();
    render();
  }
}

function initWhenReady(): void {
  // The replay data arrives via an XHR gated on a Turnstile token, so
  // "ready" can be many seconds after document_idle — poll patiently.
  const poll = window.setInterval(() => {
    if (initialized) {
      window.clearInterval(poll);
      return;
    }
    if (!engineReady() || W.replay_arr.length === 0) return;
    window.clearInterval(poll);
    try {
      instrument();
      initialized = true;
      if (enabled) buildBar();
      uiTimer = window.setInterval(uiTick, UI_TICK_MS);
      render();
    } catch (err) {
      console.error("[DBR] replay controls failed to initialize:", err);
    }
  }, 300);
}

// Debug/handles for live probing (and Playwright-injected test builds).
W.__dbrReplay = {
  state: () => ({
    initialized,
    enabled,
    userSpeed,
    seek,
    plays: fullPlays.length,
    index: currentIndex(),
    snapshots: snapMap.length,
  }),
  jumpToSeconds,
  jumpToGame,
  stepBackward,
  setSpeed,
  setEnabled,
  disable: () => {
    setEnabled(false);
    if (uiTimer !== undefined) window.clearInterval(uiTimer);
    initialized = false;
  },
};

initWhenReady();
