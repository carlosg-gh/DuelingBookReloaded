/**
 * Pure timeline model for DuelingBook's replay viewer.
 *
 * The replay page (an unobfuscated inline script — see
 * docs/duelingbook-internals.md) holds the full match as an ordered play
 * list: `previous_plays` (already executed) + `replay_arr` (remaining).
 * Each play is `{play, seconds, username, …}` with `seconds` counted from
 * the duel's start. This module turns that list into everything the
 * replay bar needs — turn/game markers, scrubber geometry, and step/jump
 * targets — with no DOM and no chrome.*, so it stays jest-testable.
 */

export interface ReplayPlay {
  play?: string;
  seconds?: number;
  username?: string;
  /** DuelingBook attaches its duel-log entry to most plays. */
  log?: { public_log?: string };
}

/**
 * Plays that never change the board: chat, watcher churn, emotes, and
 * view-window browsing. Stepping backward skips them (mirroring the
 * skip-list in DuelingBook's own hidden stepBackwardE: FAST_PLAYS +
 * PLAYS_TO_SPEED_UP_WHEN_REWINDING + View*), and the scrubber doesn't
 * count them as interesting stops.
 */
const COSMETIC_PLAYS = new Set([
  "Add watcher",
  "Remove watcher",
  "Duel message",
  "Watcher message",
  "Message",
  "Thinking",
  "Good",
  "Stop good",
  "Shuffle deck",
  "Stop viewing",
  "Countdown",
  "Call admin",
  "Cancel call",
]);

/** Plays that start a new game inside a match (DB's own boundary set). */
const GAME_BOUNDARY_PLAYS = new Set(["Begin next duel", "Back to RPS"]);

export function isCosmeticPlay(play: ReplayPlay): boolean {
  const name = play.play ?? "";
  return COSMETIC_PLAYS.has(name) || name.startsWith("View ");
}

export interface TimelineMarker {
  /** Index into the full play list. */
  index: number;
  seconds: number;
  label: string;
}

export interface TimelineModel {
  /** Play timestamps run from startSeconds to endSeconds (inclusive). */
  startSeconds: number;
  endSeconds: number;
  /** "Start turn" plays; label carries the turn number and player. */
  turns: TimelineMarker[];
  /** Game 1 starts at play 0; later games at their boundary play. */
  games: TimelineMarker[];
}

function playSeconds(play: ReplayPlay | undefined): number {
  const seconds = play?.seconds;
  return typeof seconds === "number" && isFinite(seconds) ? seconds : 0;
}

export function buildTimeline(plays: ReplayPlay[]): TimelineModel {
  const startSeconds = playSeconds(plays[0]);
  let endSeconds = startSeconds;
  const turns: TimelineMarker[] = [];
  const games: TimelineMarker[] = [];

  if (plays.length > 0) {
    games.push({ index: 0, seconds: startSeconds, label: "Game 1" });
  }
  plays.forEach((play, index) => {
    const seconds = playSeconds(play);
    if (seconds > endSeconds) endSeconds = seconds;
    if (GAME_BOUNDARY_PLAYS.has(play.play ?? "")) {
      games.push({
        index,
        seconds,
        label: `Game ${games.length + 1}`,
      });
    } else if (play.play === "Start turn") {
      turns.push({
        index,
        seconds,
        label: `Turn ${turns.length + 1}${play.username ? ` — ${play.username}` : ""}`,
      });
    }
  });

  return { startSeconds, endSeconds, turns, games };
}

/** 0..1 position of a timestamp on the scrubber. */
export function fractionForSeconds(
  model: TimelineModel,
  seconds: number,
): number {
  const span = model.endSeconds - model.startSeconds;
  if (span <= 0) return 0;
  const fraction = (seconds - model.startSeconds) / span;
  return Math.min(1, Math.max(0, fraction));
}

/** Timestamp for a 0..1 scrubber position. */
export function secondsForFraction(
  model: TimelineModel,
  fraction: number,
): number {
  const clamped = Math.min(1, Math.max(0, fraction));
  return model.startSeconds + (model.endSeconds - model.startSeconds) * clamped;
}

/**
 * The play index a scrub to `seconds` should land on: the first play at
 * or after that timestamp (so jumping to a turn marker replays that turn
 * from its beginning). Falls back to the last play.
 */
export function indexForSeconds(plays: ReplayPlay[], seconds: number): number {
  for (let i = 0; i < plays.length; i++) {
    if (playSeconds(plays[i]) >= seconds) return i;
  }
  return Math.max(0, plays.length - 1);
}

/**
 * The index a single step backward from `fromIndex` should restore to:
 * the latest non-cosmetic play strictly before it (its snapshot shows the
 * board *before* that play re-runs). -1 when there is nothing to rewind.
 */
export function previousInterestingIndex(
  plays: ReplayPlay[],
  fromIndex: number,
): number {
  for (let i = Math.min(fromIndex, plays.length) - 1; i >= 0; i--) {
    if (!isCosmeticPlay(plays[i])) return i;
  }
  return -1;
}

/** Marker (turn) strictly before / after an index, for turn jumps. */
export function markerBefore(
  markers: TimelineMarker[],
  index: number,
): TimelineMarker | null {
  let found: TimelineMarker | null = null;
  for (const marker of markers) {
    if (marker.index < index) found = marker;
    else break;
  }
  return found;
}

export function markerAfter(
  markers: TimelineMarker[],
  index: number,
): TimelineMarker | null {
  for (const marker of markers) {
    if (marker.index > index) return marker;
  }
  return null;
}

// ── Event markers (timeline icons) ─────────────────────────────────────

export type EventKind = "summon" | "activation" | "attack" | "phase" | "lp";

const SUMMON_PLAYS = new Set([
  "Normal Summon",
  "SS ATK",
  "SS DEF",
  "S. Summon ATK",
  "S. Summon DEF",
  "OL ATK",
  "OL DEF",
  "Flip Summon",
  "Summon Token",
]);

const ATTACK_PLAYS = new Set(["Attack", "Attack directly"]);

/** The icon category for a play, or null for plays that get no icon. */
export function eventKind(play: ReplayPlay): EventKind | null {
  const name = play.play ?? "";
  if (SUMMON_PLAYS.has(name)) return "summon";
  if (name.startsWith("Activate") || name === "Declare") return "activation";
  if (ATTACK_PLAYS.has(name)) return "attack";
  if (name.startsWith("Enter ")) return "phase";
  if (name === "Life points") return "lp";
  return null;
}

export interface EventMarker {
  index: number;
  seconds: number;
  kind: EventKind;
  /** Tooltip text: "who — what happened". */
  label: string;
}

/** Zone references ("in M-2", "to S-1") are noise in a tooltip. */
const ZONE_REFERENCE = /\s+(?:in|to|at|from)\s+(?:[MS]-[1-6]|LM|RM)\b/g;

export function buildEventMarkers(plays: ReplayPlay[]): EventMarker[] {
  const markers: EventMarker[] = [];
  plays.forEach((play, index) => {
    const kind = eventKind(play);
    if (!kind) return;
    const what = (play.log?.public_log || play.play || "").replace(
      ZONE_REFERENCE,
      "",
    );
    markers.push({
      index,
      seconds: playSeconds(play),
      kind,
      label: play.username ? `${play.username} — ${what}` : what,
    });
  });
  return markers;
}

/** Playback speed presets; index 1 (1×) is DuelingBook's native pace. */
export const SPEED_STEPS = [0.5, 1, 1.5, 2, 3, 4] as const;

export function nextSpeed(current: number): number {
  for (const step of SPEED_STEPS) {
    if (step > current) return step;
  }
  return SPEED_STEPS[SPEED_STEPS.length - 1];
}

export function prevSpeed(current: number): number {
  for (let i = SPEED_STEPS.length - 1; i >= 0; i--) {
    if (SPEED_STEPS[i] < current) return SPEED_STEPS[i];
  }
  return SPEED_STEPS[0];
}

/** "[m:ss]" — matches DuelingBook's own chat timestamps. */
export function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
