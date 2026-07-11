import { FanItem } from "./touchMenuData";
import { layoutFan, Point, Rect } from "./touchFanLayout";

/**
 * The touchscreen action fan: large tappable buttons laid out radially
 * around the tapped card. Pure DOM singleton (hintsOverlay pattern) — divs
 * only, nothing focusable, so it can never steal focus from the game.
 *
 * Tapping a group button re-renders the ring with that group's actions plus
 * a centered back pill; tapping a leaf action reports it via the callback.
 */

export interface FanCallbacks {
  onAction(label: string): void;
}

// circular buttons: the box is square and the CSS makes it a circle, so it
// must be big enough for the longest wrapped labels ("To Bottom of Deck")
const BUTTON = { width: 110, height: 110 };
const EDGE_MARGIN = 8;

let root: HTMLDivElement | null = null;
let open = false;
let anchorRect: Rect | null = null;
let topLevelItems: FanItem[] = [];
let callbacks: FanCallbacks | null = null;

function ensureRoot(): HTMLDivElement {
  if (!root) {
    root = document.createElement("div");
    root.id = "dbr-touch-fan";
    document.body.appendChild(root);
  }
  return root;
}

function makeButton(
  label: string,
  center: Point,
  className: string,
  onTap: () => void,
): HTMLDivElement {
  const button = document.createElement("div");
  button.className = className;
  button.style.left = `${Math.round(center.x - BUTTON.width / 2)}px`;
  button.style.top = `${Math.round(center.y - BUTTON.height / 2)}px`;
  button.style.width = `${BUTTON.width}px`;
  button.style.height = `${BUTTON.height}px`;

  const text = document.createElement("span");
  text.className = "dbr-fan-btn-txt";
  text.textContent = label;
  button.appendChild(text);

  let touched = false;
  button.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      button.classList.add("dbr-fan-btn-active");
    },
    { passive: false },
  );
  button.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      button.classList.remove("dbr-fan-btn-active");
      touched = true;
      onTap();
    },
    { passive: false },
  );
  button.addEventListener("touchcancel", () => {
    button.classList.remove("dbr-fan-btn-active");
  });
  // mouse fallback (touch emulation quirks, stylus); preventDefault on
  // touchend suppresses the compat click, so this never double-fires
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!touched) onTap();
    touched = false;
  });
  return button;
}

function render(items: FanItem[], withBack: boolean): void {
  if (!anchorRect || !callbacks) return;
  const container = ensureRoot();
  container.replaceChildren();

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const layout = layoutFan(
    anchorRect,
    viewport,
    items.length,
    BUTTON,
    EDGE_MARGIN,
  );

  items.forEach((item, i) => {
    const center = layout.positions[i];
    if (!center) return;
    if (item.kind === "group") {
      container.appendChild(
        makeButton(
          `${item.group} ▸`,
          center,
          "dbr-fan-btn dbr-fan-btn-group",
          () =>
            render(
              item.children.map((label) => ({ kind: "action", label })),
              true,
            ),
        ),
      );
    } else {
      container.appendChild(
        makeButton(item.label, center, "dbr-fan-btn", () =>
          callbacks?.onAction(item.label),
        ),
      );
    }
  });

  if (withBack) {
    // hand cards sit half below the viewport bottom — clamp the back pill
    // fully on-screen or its center can be unclickable
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max);
    const backCenter = {
      x: clamp(
        anchorRect.left + anchorRect.width / 2,
        EDGE_MARGIN + BUTTON.width / 2,
        viewport.width - EDGE_MARGIN - BUTTON.width / 2,
      ),
      y: clamp(
        anchorRect.top + anchorRect.height / 2,
        EDGE_MARGIN + BUTTON.height / 2,
        viewport.height - EDGE_MARGIN - BUTTON.height / 2,
      ),
    };
    container.appendChild(
      makeButton("◀ Back", backCenter, "dbr-fan-btn dbr-fan-btn-back", () =>
        render(topLevelItems, false),
      ),
    );
  }

  container.classList.add("dbr-fan-visible");
  open = true;
}

export function showFan(
  anchor: Rect,
  items: FanItem[],
  cb: FanCallbacks,
): void {
  anchorRect = anchor;
  topLevelItems = items;
  callbacks = cb;
  render(items, false);
}

export function hideFan(): void {
  open = false;
  anchorRect = null;
  callbacks = null;
  root?.classList.remove("dbr-fan-visible");
  root?.replaceChildren();
}

export function isFanOpen(): boolean {
  return open;
}

/** Is this event target inside the fan overlay? */
export function fanContains(target: EventTarget | null): boolean {
  return root !== null && target instanceof Node && root.contains(target);
}
