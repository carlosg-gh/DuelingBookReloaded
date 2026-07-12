import { ContextHotkeyEntry, parseSequence } from "./configUtility";
import { buildHintGroups, HintGroup } from "./hintsData";
import { displayToken } from "./keyNormalization";
import { Continuation } from "./sequenceMatcher";

/**
 * In-game hotkey hints: a full overlay toggled by the "Show Hotkey Hints"
 * action, plus a small transient box that appears while a sequence is
 * pending. Pure DOM, no focusable elements — it can never steal focus from
 * the game.
 */

let groups: HintGroup[] = [];
let panel: HTMLDivElement | null = null;
let transient: HTMLDivElement | null = null;
let open = false;
let activePrefix: string[] = [];

function keycaps(tokens: string[], dimCount = 0): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "dbr-hints-keys";
  tokens.forEach((token, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "dbr-hints-sep";
      sep.textContent = "→";
      span.appendChild(sep);
    }
    const cap = document.createElement("span");
    cap.className =
      i < dimCount ? "dbr-hints-key dbr-hints-dim" : "dbr-hints-key";
    cap.textContent = displayToken(token);
    span.appendChild(cap);
  });
  return span;
}

function ensurePanel(): HTMLDivElement {
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "dbr-hints-overlay";
    document.body.appendChild(panel);
  }
  return panel;
}

function ensureTransient(): HTMLDivElement {
  if (!transient) {
    transient = document.createElement("div");
    transient.id = "dbr-hints-transient";
    document.body.appendChild(transient);
  }
  return transient;
}

function renderPanel(prefix: string[]): void {
  const root = ensurePanel();
  root.replaceChildren();

  const title = document.createElement("div");
  title.className = "dbr-hints-title";
  title.textContent =
    prefix.length > 0 ? "Hotkeys — continuing sequence…" : "Hotkeys";
  root.appendChild(title);

  const columns = document.createElement("div");
  columns.className = "dbr-hints-columns";
  root.appendChild(columns);

  let rendered = 0;
  for (const group of groups) {
    const rows = group.rows.filter((row) => {
      if (prefix.length === 0) return true;
      const tokens = parseSequence(row.hotkey);
      return (
        tokens.length > prefix.length &&
        prefix.every((token, i) => tokens[i] === token)
      );
    });
    if (rows.length === 0) continue;

    const section = document.createElement("div");
    section.className = "dbr-hints-group";
    const heading = document.createElement("div");
    heading.className = "dbr-hints-heading";
    heading.textContent = group.title;
    section.appendChild(heading);

    for (const row of rows) {
      const line = document.createElement("div");
      line.className = "dbr-hints-row";
      const label = document.createElement("span");
      label.className = "dbr-hints-label";
      label.textContent = row.label;
      line.appendChild(label);
      line.appendChild(keycaps(parseSequence(row.hotkey), prefix.length));
      section.appendChild(line);
      rendered++;
    }
    columns.appendChild(section);
  }

  if (rendered === 0) {
    const empty = document.createElement("div");
    empty.className = "dbr-hints-empty";
    empty.textContent =
      prefix.length > 0
        ? "No bindings continue this sequence"
        : "No hotkeys enabled";
    root.appendChild(empty);
  }

  root.classList.add("dbr-hints-visible");
}

function renderTransient(
  prefix: string[],
  continuations: Continuation[],
): void {
  const box = ensureTransient();
  box.replaceChildren();

  const header = document.createElement("div");
  header.className = "dbr-hints-transient-header";
  header.appendChild(keycaps(prefix));
  const ellipsis = document.createElement("span");
  ellipsis.className = "dbr-hints-sep";
  ellipsis.textContent = "…";
  header.appendChild(ellipsis);
  box.appendChild(header);

  // map actions back to hint-row labels where possible
  const labelFor = (actions: string[]): string => {
    for (const group of groups) {
      for (const row of group.rows) {
        if (actions.some((action) => row.actions.includes(action))) {
          return row.label;
        }
      }
    }
    return actions.join("/");
  };

  for (const continuation of continuations) {
    const line = document.createElement("div");
    line.className = "dbr-hints-row";
    line.appendChild(keycaps(continuation.rest));
    const label = document.createElement("span");
    label.className = "dbr-hints-label";
    label.textContent = labelFor(continuation.actions);
    line.appendChild(label);
    box.appendChild(line);
  }

  box.classList.add("dbr-hints-visible");
}

function hideTransient(): void {
  transient?.classList.remove("dbr-hints-visible");
}

export function setEntries(entries: ContextHotkeyEntry[]): void {
  groups = buildHintGroups(entries);
  activePrefix = [];
  hideTransient();
  if (groups.length === 0) {
    hide();
  } else if (open) {
    renderPanel(activePrefix);
  }
}

export function isOpen(): boolean {
  return open;
}

export function show(): void {
  if (groups.length === 0) return;
  open = true;
  renderPanel(activePrefix);
}

export function hide(): void {
  open = false;
  activePrefix = [];
  panel?.classList.remove("dbr-hints-visible");
  hideTransient();
}

export function toggle(): void {
  if (open) hide();
  else show();
}

/** A sequence prefix is pending: narrow the overlay or show the transient hint. */
export function onPrefix(
  prefix: string[],
  continuations: Continuation[],
): void {
  activePrefix = prefix;
  if (open) {
    renderPanel(prefix);
  } else {
    renderTransient(prefix, continuations);
  }
}

/** The pending sequence ended (fire, dead end, or timeout). */
export function onReset(): void {
  activePrefix = [];
  hideTransient();
  if (open) renderPanel([]);
}
