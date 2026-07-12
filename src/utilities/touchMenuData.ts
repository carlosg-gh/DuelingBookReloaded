import { TouchMode } from "./optionsUtility";

/**
 * Grouping model for the touchscreen action fan. Pure — no DOM, no chrome.*.
 *
 * DuelingBook's card menu offers a context-dependent list of action labels.
 * To keep the fan uncluttered, related actions collapse into a group button
 * that fans out into a sub-fan. Labels are matched as whole strings — some
 * contain "/" ("To S/T") and must never be split.
 */

export type GroupName = "Summon" | "Send To" | "Position" | "Reveal" | "Move";

/**
 * Grouping depends on where the menu came from: the same label can mean
 * different things on a card vs. a pile (e.g. "Banish FD" banishes *this
 * card* face-down from a card menu, but the *top card* from the deck menu).
 */
export type FanContext = "card" | "pile";

export type FanItem =
  | { kind: "action"; label: string }
  | { kind: "group"; group: GroupName; children: string[] };

// Labels that stay at the top level even though a group might fit them.
// Frequent/urgent actions must always be one tap away.
const TOP_LEVEL_LABELS = new Set([
  "Activate",
  "Attack",
  "Attack Directly",
  "Target",
  "Declare",
  "View",
  "Detach",
  "Attach",
  "Resolve Effect",
  "Choose",
]);

const GROUPS: Record<GroupName, string[]> = {
  Summon: [
    "Normal Summon",
    "Set",
    "Set (To S/T)",
    "Set to Monster Zone",
    "S. Summon ATK",
    "SS ATK",
    "S. Summon DEF",
    "SS DEF",
    "Flip Summon",
    "Overlay",
    "OL ATK",
    "OL DEF",
  ],
  "Send To": [
    "To Graveyard",
    "To Grave",
    "Banish",
    "Banish FD",
    "To Hand",
    "To Opponent's Hand",
    "To Extra Deck",
    "To Extra Deck FU",
    "To Top of Deck",
    "To T. Deck",
    "To Top of Deck face-up",
    "To Bottom of Deck",
    "To B. Deck",
    "To S/T",
    "Remove",
  ],
  Position: [
    "To ATK",
    "To DEF",
    "Flip",
    "Move",
    "Swap",
    "Set to other side",
    "Activate to other side",
    "Activate Left",
    "Activate Right",
  ],
  Reveal: [
    "Reveal",
    "Show",
    "Stay Revealed",
    "Stop Revealing",
    "Look at cards",
    "Look at opponent cards",
    "Look at top card",
    "Check Options",
  ],
  Move: [],
};

// Pile menus (deck/extra/GY/banished): View, Draw and Shuffle stay one tap
// away; everything that moves cards off the pile fans out under "Move".
const PILE_TOP_LEVEL = new Set(["View", "Show", "Draw", "Shuffle"]);

const PILE_GROUPS: Record<GroupName, string[]> = {
  Summon: [],
  "Send To": [],
  Position: [],
  Reveal: [],
  Move: [
    "Banish T.",
    "Banish B.",
    "Banish FD",
    "Mill",
    "Mill 3 Cards",
    "Banish 3 Cards",
    "Banish 8 Cards FD",
    "Banish 10 Cards FD",
    "Banish 3 ED Cards FD",
    "Banish 6 ED Cards FD",
    "Banish random ED Card",
    "Banish random FD ED card",
  ],
};

function labelMap(groups: Record<GroupName, string[]>): Map<string, GroupName> {
  const map = new Map<string, GroupName>();
  for (const [group, labels] of Object.entries(groups) as [
    GroupName,
    string[],
  ][]) {
    for (const label of labels) map.set(label, group);
  }
  return map;
}

const CARD_LABEL_TO_GROUP = labelMap(GROUPS);
const PILE_LABEL_TO_GROUP = labelMap(PILE_GROUPS);

/**
 * Turn the native menu's ordered labels into the fan model. Rules:
 * - top-level and unknown labels stay direct actions, in place;
 * - grouped labels accumulate into a group placed where its first member
 *   appeared, preserving relative order;
 * - a group that ends up with a single member is promoted to a direct action.
 */
export function buildFanModel(
  labels: string[],
  context: FanContext = "card",
): FanItem[] {
  const topLevel = context === "pile" ? PILE_TOP_LEVEL : TOP_LEVEL_LABELS;
  const groupOf =
    context === "pile" ? PILE_LABEL_TO_GROUP : CARD_LABEL_TO_GROUP;
  const items: FanItem[] = [];
  const groupItems = new Map<
    GroupName,
    { kind: "group"; group: GroupName; children: string[] }
  >();

  for (const label of labels) {
    const group = topLevel.has(label) ? undefined : groupOf.get(label);
    if (!group) {
      items.push({ kind: "action", label });
      continue;
    }
    let item = groupItems.get(group);
    if (!item) {
      item = { kind: "group", group, children: [] };
      groupItems.set(group, item);
      items.push(item);
    }
    item.children.push(label);
  }

  return items.map((item) =>
    item.kind === "group" && item.children.length === 1
      ? { kind: "action", label: item.children[0] }
      : item,
  );
}

/** True when the fan tables know this label (top-level or grouped). */
export function isKnownFanLabel(
  label: string,
  context: FanContext = "card",
): boolean {
  return context === "pile"
    ? PILE_TOP_LEVEL.has(label) || PILE_LABEL_TO_GROUP.has(label)
    : TOP_LEVEL_LABELS.has(label) || CARD_LABEL_TO_GROUP.has(label);
}

// "Draw" and "Shuffle" are always in the main deck's menu and never in a
// card's; the extra pile's menu draws from a tiny fixed vocabulary.
const MAIN_PILE_SIGNATURE = ["Draw", "Shuffle"];
const EXTRA_PILE_VOCABULARY = new Set([
  "View",
  "Show",
  "Banish random ED Card",
  "Banish random FD ED card",
]);

/**
 * Does this label set look like the given pile's native menu? Used to
 * verify that a menu which was already open before a synthetic pile hover
 * actually belongs to the pile — DuelingBook silently refuses to swap
 * menus while a card is tweening, an overlay is up, or a view is open,
 * leaving a hovered card's menu in place.
 */
export function isPileMenuLabels(
  pile: "main" | "extra",
  labels: string[],
): boolean {
  if (pile === "main") {
    return MAIN_PILE_SIGNATURE.every((label) => labels.includes(label));
  }
  return (
    labels.length > 0 &&
    labels.every((label) => EXTRA_PILE_VOCABULARY.has(label))
  );
}

/** Resolve the tri-state option against the device's pointer capability. */
export function resolveTouchActive(
  mode: TouchMode,
  coarsePointer: boolean,
): boolean {
  if (mode === "on") return true;
  if (mode === "off") return false;
  return coarsePointer;
}
