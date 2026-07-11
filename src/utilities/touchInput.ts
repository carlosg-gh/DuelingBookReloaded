import * as fanOverlay from "./touchFanOverlay";
import { buildFanModel, FanContext } from "./touchMenuData";
import {
  clickMenuAction,
  closeNativeMenu,
  isMenuOpen,
  openCardMenu,
  openPileMenu,
  readMenuLabels,
  watchMenuRemoval,
} from "./touchNativeMenu";

/**
 * Touchscreen mode orchestrator. A single window-level capture-phase touch
 * classifier claims every touch into exactly one branch, so for any tap
 * either the browser's compat mouse events fire or our synthetic ones do —
 * never both:
 *
 * 1. fan overlay elements  → the fan's own listeners handle it
 * 2. input/a/select/textarea → untouched (browser compat events, chat focus
 *    and the typingIntent logic keep working)
 * 3. duel cards and piles  → tap opens/switches/dismisses the action fan
 * 4. everything else       → tap-to-hover shim (the touch→mouse translation
 *    DuelingBook ships disabled in initTouchEvents)
 */

const PILE_SELECTOR =
  "#deck_hidden, #extra_hidden, #grave_hidden, #banished_hidden";
const INTERACTIVE_SELECTOR = "input, a, select, textarea";
const TAP_MAX_MOVEMENT = 10;
const TAP_MAX_MS = 500;
const DOUBLE_TAP_MS = 300;

type TouchClaim = "anchor" | "dismiss" | "shim";

interface PendingTouch {
  id: number;
  claim: TouchClaim;
  target: HTMLElement;
  anchor: HTMLElement | null;
  startX: number;
  startY: number;
  startTime: number;
  moved: boolean;
}

let enabled = false;
let pending: PendingTouch | null = null;
let openAnchor: HTMLElement | null = null;
let stopMenuWatch: (() => void) | null = null;
let shimHoverTarget: HTMLElement | null = null;
let lastShimTap: { target: HTMLElement; time: number } | null = null;

function syntheticMouse(type: string, point: { x: number; y: number }) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: point.x,
    clientY: point.y,
    relatedTarget: document.body,
  });
}

function closeFan() {
  stopMenuWatch?.();
  stopMenuWatch = null;
  fanOverlay.hideFan();
  if (openAnchor && isMenuOpen()) closeNativeMenu(openAnchor);
  openAnchor = null;
}

function openFanFor(anchor: HTMLElement, point: { x: number; y: number }) {
  const isPile = anchor.matches(PILE_SELECTOR);
  const open = () => (isPile ? openPileMenu : openCardMenu)(anchor, point);
  const context = isPile ? "pile" : "card";
  let labels = open();
  if (!labels) {
    // showMenu can silently refuse (card tweening, overlay up): retry once
    requestAnimationFrame(() => {
      labels = open();
      if (labels) presentFan(anchor, labels, context);
    });
    return;
  }
  presentFan(anchor, labels, context);
}

function presentFan(
  anchor: HTMLElement,
  labels: string[],
  context: FanContext,
) {
  openAnchor = anchor;
  const openedLabels = labels.join("\n");
  fanOverlay.showFan(
    anchor.getBoundingClientRect(),
    buildFanModel(labels, context),
    {
      onAction: (label) => {
        // disconnect before clicking: DuelingBook removes the menu itself and
        // the watcher must not race a redundant close
        stopMenuWatch?.();
        stopMenuWatch = null;
        // if the native menu changed underneath the fan (game-state change),
        // acting would hit the wrong card — just close instead
        if (readMenuLabels().join("\n") === openedLabels) {
          clickMenuAction(label);
        }
        fanOverlay.hideFan();
        if (openAnchor && isMenuOpen()) closeNativeMenu(openAnchor);
        openAnchor = null;
      },
    },
  );
  // the game can remove the menu out from under us (opponent moves, DB's
  // own close paths) — never let the fan outlive it
  stopMenuWatch = watchMenuRemoval(() => {
    stopMenuWatch = null;
    fanOverlay.hideFan();
    openAnchor = null;
  });
}

function shimMouseUpIfHovering(point: { x: number; y: number }) {
  if (shimHoverTarget) {
    shimHoverTarget.dispatchEvent(syntheticMouse("mouseup", point));
  }
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length > 1) {
    // multi-touch (pinch zoom): abandon whatever we were doing, don't block
    if (pending?.claim === "shim") {
      shimMouseUpIfHovering({ x: pending.startX, y: pending.startY });
    }
    pending = null;
    return;
  }
  if (pending) return;

  const touch = e.changedTouches[0];
  const target = e.target instanceof HTMLElement ? e.target : null;
  if (!target) return;

  // 1. the fan's own listeners handle its buttons
  if (fanOverlay.fanContains(target)) return;

  // 2. deliberate typing/interaction targets stay fully native
  if (target.closest(INTERACTIVE_SELECTOR)) return;

  const base = {
    id: touch.identifier,
    target,
    startX: touch.clientX,
    startY: touch.clientY,
    startTime: Date.now(),
    moved: false,
  };

  // 3. duel cards and piles (deck-editor .cards have no card menu — leave
  // them to the shim)
  const anchor =
    (target.closest("#duel .card") as HTMLElement | null) ??
    (target.closest(PILE_SELECTOR) as HTMLElement | null);
  if (anchor) {
    e.preventDefault();
    pending = { ...base, claim: "anchor", anchor };
    return;
  }

  // a tap elsewhere while the fan is open only dismisses it
  if (fanOverlay.isFanOpen()) {
    e.preventDefault();
    pending = { ...base, claim: "dismiss", anchor: null };
    return;
  }

  // 4. generic tap-to-hover shim
  e.preventDefault();
  const point = { x: touch.clientX, y: touch.clientY };
  if (shimHoverTarget && shimHoverTarget !== target) {
    shimHoverTarget.dispatchEvent(syntheticMouse("mouseout", point));
  }
  target.dispatchEvent(syntheticMouse("mouseover", point));
  target.dispatchEvent(syntheticMouse("mousedown", point));
  shimHoverTarget = target;
  pending = { ...base, claim: "shim", anchor: null };
}

function onTouchMove(e: TouchEvent) {
  if (!pending) return;
  const touch = Array.from(e.changedTouches).find(
    (t) => t.identifier === pending!.id,
  );
  if (!touch) return;
  if (
    Math.hypot(touch.clientX - pending.startX, touch.clientY - pending.startY) >
    TAP_MAX_MOVEMENT
  ) {
    pending.moved = true;
  }
}

function onTouchEnd(e: TouchEvent) {
  if (!pending) return;
  const touch = Array.from(e.changedTouches).find(
    (t) => t.identifier === pending!.id,
  );
  if (!touch) return;

  const current = pending;
  pending = null;
  const point = { x: touch.clientX, y: touch.clientY };
  const isTap = !current.moved && Date.now() - current.startTime <= TAP_MAX_MS;

  switch (current.claim) {
    case "anchor": {
      e.preventDefault();
      if (!isTap || !current.anchor) return;
      if (fanOverlay.isFanOpen()) {
        const previous = openAnchor;
        closeFan();
        // tapping the fan's own card again just dismisses it
        if (previous === current.anchor) return;
      }
      openFanFor(current.anchor, point);
      return;
    }
    case "dismiss": {
      e.preventDefault();
      closeFan();
      return;
    }
    case "shim": {
      e.preventDefault();
      current.target.dispatchEvent(syntheticMouse("mouseup", point));
      shimHoverTarget = current.target;
      if (!isTap) return;
      current.target.dispatchEvent(syntheticMouse("click", point));
      const now = Date.now();
      if (
        lastShimTap &&
        lastShimTap.target === current.target &&
        now - lastShimTap.time <= DOUBLE_TAP_MS
      ) {
        current.target.dispatchEvent(syntheticMouse("dblclick", point));
        lastShimTap = null;
      } else {
        lastShimTap = { target: current.target, time: now };
      }
      return;
    }
  }
}

function onTouchCancel(e: TouchEvent) {
  if (!pending) return;
  const touch = Array.from(e.changedTouches).find(
    (t) => t.identifier === pending!.id,
  );
  if (!touch) return;
  if (pending.claim === "shim") {
    pending.target.dispatchEvent(
      syntheticMouse("mouseup", { x: touch.clientX, y: touch.clientY }),
    );
  }
  pending = null;
}

// While touch mode is active the native menu is CSS-hidden, so a mouse user
// hovering a card would see nothing — real mouse clicks on cards/piles must
// open the fan exactly like taps do (touchscreen laptops, or "On" forced on
// a desktop). Only trusted events count: our own synthetic clicks (card
// preview, shim) must not re-enter here.

let mouseDownPoint: { x: number; y: number } | null = null;

function onMouseDown(e: MouseEvent) {
  if (e.isTrusted) mouseDownPoint = { x: e.clientX, y: e.clientY };
}

function onMouseClick(e: MouseEvent) {
  if (!e.isTrusted) return;
  // a click at the end of a drag (card move) must not open the fan
  if (
    mouseDownPoint &&
    Math.hypot(e.clientX - mouseDownPoint.x, e.clientY - mouseDownPoint.y) >
      TAP_MAX_MOVEMENT
  ) {
    return;
  }
  const target = e.target instanceof HTMLElement ? e.target : null;
  if (!target) return;
  // fan buttons handle their own clicks; typing targets stay native
  if (fanOverlay.fanContains(target)) return;
  if (target.closest(INTERACTIVE_SELECTOR)) return;

  const anchor =
    (target.closest("#duel .card") as HTMLElement | null) ??
    (target.closest(PILE_SELECTOR) as HTMLElement | null);
  if (anchor) {
    if (fanOverlay.isFanOpen()) {
      const previous = openAnchor;
      closeFan();
      // clicking the fan's own card again just dismisses it
      if (previous === anchor) return;
    }
    openFanFor(anchor, { x: e.clientX, y: e.clientY });
    return;
  }
  // a click elsewhere while the fan is open dismisses it
  if (fanOverlay.isFanOpen()) closeFan();
}

// While the fan is open, a real mouse crossing other cards would make
// DuelingBook swap the (invisible) native menu underneath it — a fan click
// could then act on the wrong card. Freeze card/pile hover until the fan
// closes; our synthetic events are untrusted and pass through.
function onMouseHoverGuard(e: MouseEvent) {
  if (!e.isTrusted || !fanOverlay.isFanOpen()) return;
  const target = e.target instanceof HTMLElement ? e.target : null;
  if (!target) return;
  if (target.closest("#duel .card") || target.closest(PILE_SELECTOR)) {
    e.stopImmediatePropagation();
  }
}

function onResize() {
  if (fanOverlay.isFanOpen()) closeFan();
}

export function isTouchModeEnabled(): boolean {
  return enabled;
}

export function enableTouchMode(): void {
  if (enabled) return;
  enabled = true;
  document.documentElement.classList.add("dbr-touch");
  window.addEventListener("touchstart", onTouchStart, {
    capture: true,
    passive: false,
  });
  window.addEventListener("touchmove", onTouchMove, {
    capture: true,
    passive: true,
  });
  window.addEventListener("touchend", onTouchEnd, {
    capture: true,
    passive: false,
  });
  window.addEventListener("touchcancel", onTouchCancel, {
    capture: true,
    passive: true,
  });
  window.addEventListener("mousedown", onMouseDown, true);
  window.addEventListener("click", onMouseClick, true);
  window.addEventListener("mouseover", onMouseHoverGuard, true);
  window.addEventListener("mouseout", onMouseHoverGuard, true);
  window.addEventListener("resize", onResize);
}

export function disableTouchMode(): void {
  if (!enabled) return;
  enabled = false;
  document.documentElement.classList.remove("dbr-touch");
  window.removeEventListener("touchstart", onTouchStart, { capture: true });
  window.removeEventListener("touchmove", onTouchMove, { capture: true });
  window.removeEventListener("touchend", onTouchEnd, { capture: true });
  window.removeEventListener("touchcancel", onTouchCancel, { capture: true });
  window.removeEventListener("mousedown", onMouseDown, true);
  window.removeEventListener("click", onMouseClick, true);
  window.removeEventListener("mouseover", onMouseHoverGuard, true);
  window.removeEventListener("mouseout", onMouseHoverGuard, true);
  window.removeEventListener("resize", onResize);
  closeFan();
  pending = null;
  shimHoverTarget = null;
  lastShimTap = null;
  mouseDownPoint = null;
}
