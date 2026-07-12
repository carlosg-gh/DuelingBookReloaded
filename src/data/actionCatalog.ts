/**
 * Single source of truth for every bindable action: where it can appear
 * (its placements — one per hover-context group, each with its own default
 * binding), how it's executed (kind), and which DuelingBook menu label it
 * clicks. Default bindings, the content script's action→function map, the
 * per-context matchers, the options-page groups, and the conflict rules
 * are all derived from this table.
 *
 * The binding unit is (context group, action): the same action may hold
 * different keys in different groups, and keys only conflict within one
 * group (plus the Global group, which fires everywhere).
 *
 * Context data was read out of DuelingBook's client (`duel.js?v=926`,
 * deobfuscated — see docs/duelingbook-internals.md): `cardMenuE()` builds
 * the card menu with one branch per context, `showDeckMenu()` /
 * `showExtraDeckMenu()` build the pile menus, and `showMenu()` aliases
 * labels on small cards (S. Summon ATK→SS ATK, To Graveyard→To Grave,
 * To Top of Deck→To T. Deck, To Bottom of Deck→To B. Deck), which is why
 * each full/abbreviated pair lives in disjoint groups.
 */

export type ContextTag =
  | "handMonster"
  | "handST" // spells & traps in hand
  | "fieldMonsterFaceUp"
  | "fieldMonsterFaceDown"
  | "fieldST" // set/face-up backrow, field spell zone, pendulum zones
  | "mainPile"
  | "extraPile"
  | "graveCard"
  | "banishedCard"
  | "deckViewCard" // card rows while viewing/picking from your deck
  | "extraDeckCard" // card rows while viewing your Extra Deck
  | "xyzMaterial" // the menu resets to Detach/Banish for materials
  | "opponentCard"; // opponent's graveyard/banished cards

export type ContextGroup = ContextTag | "global" | "replay";

export type ActionKind =
  // Clicks a label in whatever #card_menu is already open; no-ops when the
  // label isn't there.
  | "cardMenu"
  // Clicks a label in the pile's menu, but only while the pointer hovers
  // that pile (the menu is verified by label signature and re-opened when
  // DuelingBook dropped it).
  | "pileHover"
  // Opens a pile's menu via synthetic hover, then clicks — fires from
  // anywhere, so it lives in the Global group.
  | "pileMenu"
  // Unconditional page action (views, LP, chat…) — Global group.
  | "global"
  // Replay-viewer control, forwarded to the MAIN-world replay driver via
  // postMessage — Replay group, which only matches on /replay pages.
  | "replay";

export interface Placement {
  context: ContextGroup;
  /** "" = ships unbound in this group. */
  defaultHotkey: string;
}

export interface CatalogEntry {
  /** Stable id; also the storage key in hotkeysConfigV2. */
  action: string;
  kind: ActionKind;
  /** Exact `.card_menu_btn span` text to click (all kinds but global). */
  menuLabel?: string;
  /** pileHover/pileMenu: which pile's menu. */
  pile?: "main" | "extra";
  /** One per context group the action is bindable in. */
  placements: Placement[];
  /** Subhead within the Global group's options section. */
  section: string;
  /** Fixed bindings the options page can't rebind or disable. */
  locked?: boolean;
}

/** Options-page / hints section order. */
export const GROUP_ORDER: ContextGroup[] = [
  "global",
  "mainPile",
  "extraPile",
  "handMonster",
  "handST",
  "fieldMonsterFaceUp",
  "fieldMonsterFaceDown",
  "fieldST",
  "graveCard",
  "banishedCard",
  "deckViewCard",
  "extraDeckCard",
  "xyzMaterial",
  "opponentCard",
  "replay",
];

export const GROUP_LABELS: Record<ContextGroup, string> = {
  global: "Anywhere",
  mainPile: "Deck Pile (hovering)",
  extraPile: "Extra Deck Pile (hovering)",
  handMonster: "Hand — Monsters",
  handST: "Hand — Spells & Traps",
  fieldMonsterFaceUp: "Your Monsters — Face-up",
  fieldMonsterFaceDown: "Your Monsters — Face-down",
  fieldST: "Your Spells & Traps",
  graveCard: "Graveyard Cards",
  banishedCard: "Banished Cards",
  deckViewCard: "Deck Cards (viewing)",
  extraDeckCard: "Extra Deck Cards (viewing)",
  xyzMaterial: "Xyz Materials",
  opponentCard: "Opponent's GY/Banished Cards",
  replay: "Replay Viewer",
};

// Global-section subheads (options page).
export const PILES_VIEWS = "Piles & Views";
export const MILLS = "Mills";
export const LP = "LP";
export const EMOTES = "Emotes/Chat Box";
export const EXTENSION = "Extension";
export const REPLAY = "Replay Viewer";
// Card-group entries keep a section for consistency; it is not rendered.
const CARD = "Card Actions";

/** Same default key across several groups, with optional per-group overrides. */
function spread(
  defaultHotkey: string,
  contexts: ContextTag[],
  overrides: Partial<Record<ContextTag, string>> = {},
): Placement[] {
  return contexts.map((context) => ({
    context,
    defaultHotkey: overrides[context] ?? defaultHotkey,
  }));
}

const globalPlacement = (defaultHotkey: string): Placement[] => [
  { context: "global", defaultHotkey },
];

const replayPlacement = (defaultHotkey: string): Placement[] => [
  { context: "replay", defaultHotkey },
];

// Within each placement group, catalog order is fire order when a merged
// (ambiguous-context) matcher yields several actions for one key; the
// first whose label is present in the menu acts.
export const actionCatalog: CatalogEntry[] = [
  // ── Global: views ────────────────────────────────────────────────────
  {
    action: "Close View Menu",
    kind: "global",
    placements: globalPlacement("escape"),
    section: PILES_VIEWS,
    locked: true,
  },
  {
    action: "View Graveyard",
    kind: "global",
    placements: globalPlacement("v g"),
    section: PILES_VIEWS,
  },
  {
    action: "View Banish",
    kind: "global",
    placements: globalPlacement("v b"),
    section: PILES_VIEWS,
  },
  {
    action: "View Main Deck",
    kind: "pileMenu",
    menuLabel: "View",
    pile: "main",
    placements: globalPlacement("v d"),
    section: PILES_VIEWS,
  },
  {
    action: "View Extra Deck",
    kind: "pileMenu",
    menuLabel: "View",
    pile: "extra",
    placements: globalPlacement("v e"),
    section: PILES_VIEWS,
  },

  // ── Deck pile (hover) ────────────────────────────────────────────────
  {
    action: "Draw",
    kind: "pileHover",
    menuLabel: "Draw",
    pile: "main",
    placements: spread("d", ["mainPile"]),
    section: PILES_VIEWS,
  },
  {
    action: "Banish T.",
    kind: "pileHover",
    menuLabel: "Banish T.",
    pile: "main",
    placements: spread("b", ["mainPile"]),
    section: PILES_VIEWS,
  },
  {
    action: "Banish FD (Deck)",
    kind: "pileHover",
    menuLabel: "Banish FD",
    pile: "main",
    placements: spread("shift+b", ["mainPile"]),
    section: PILES_VIEWS,
  },
  {
    action: "Mill Deck",
    kind: "pileHover",
    menuLabel: "Mill",
    pile: "main",
    placements: spread("m", ["mainPile"]),
    section: PILES_VIEWS,
  },
  {
    action: "Shuffle",
    kind: "pileHover",
    menuLabel: "Shuffle",
    pile: "main",
    placements: spread("s", ["mainPile"]),
    section: PILES_VIEWS,
  },
  {
    action: "Show Deck",
    kind: "pileHover",
    menuLabel: "Show",
    pile: "main",
    placements: spread("", ["mainPile"]),
    section: PILES_VIEWS,
  },
  {
    action: "Show Extra Deck",
    kind: "pileHover",
    menuLabel: "Show",
    pile: "extra",
    placements: spread("", ["extraPile"]),
    section: PILES_VIEWS,
  },

  // ── Card actions ─────────────────────────────────────────────────────
  {
    action: "Activate",
    kind: "cardMenu",
    menuLabel: "Activate",
    placements: spread("a", ["handST", "fieldST", "deckViewCard"]),
    section: CARD,
  },
  {
    action: "To S/T",
    kind: "cardMenu",
    menuLabel: "To S/T",
    // Unbound in handST where Activate holds "a"; "t s" where "a" belongs
    // to Attach/Activate.
    placements: spread(
      "a",
      ["handMonster", "handST", "graveCard", "extraDeckCard", "deckViewCard"],
      { handST: "", graveCard: "t s", deckViewCard: "t s" },
    ),
    section: CARD,
  },
  {
    action: "Normal Summon",
    kind: "cardMenu",
    menuLabel: "Normal Summon",
    placements: spread("n", ["handMonster"]),
    section: CARD,
  },
  {
    action: "Set",
    kind: "cardMenu",
    menuLabel: "Set",
    // Plain "s" where nothing else needs it; ⇧S where "s a"/"s d"
    // sequences (handMonster) or convention (fieldST) hold "s".
    placements: spread(
      "shift+s",
      ["handMonster", "handST", "fieldMonsterFaceUp", "fieldST"],
      { handST: "s", fieldMonsterFaceUp: "s" },
    ),
    section: CARD,
  },
  {
    action: "Set (To S/T)",
    kind: "cardMenu",
    menuLabel: "Set (To S/T)",
    // Set holds shift+s in handMonster.
    placements: spread("", ["handMonster"]),
    section: CARD,
  },
  {
    action: "S. Summon ATK",
    kind: "cardMenu",
    menuLabel: "S. Summon ATK",
    placements: spread("s a", ["handMonster"]),
    section: CARD,
  },
  {
    action: "S. Summon DEF",
    kind: "cardMenu",
    menuLabel: "S. Summon DEF",
    placements: spread("s d", ["handMonster"]),
    section: CARD,
  },
  {
    action: "SS ATK",
    kind: "cardMenu",
    menuLabel: "SS ATK",
    placements: spread("s a", [
      "graveCard",
      "banishedCard",
      "extraDeckCard",
      "deckViewCard",
      "opponentCard",
    ]),
    section: CARD,
  },
  {
    action: "SS DEF",
    kind: "cardMenu",
    menuLabel: "SS DEF",
    placements: spread("s d", [
      "graveCard",
      "banishedCard",
      "extraDeckCard",
      "deckViewCard",
      "opponentCard",
    ]),
    section: CARD,
  },
  {
    action: "OL ATK",
    kind: "cardMenu",
    menuLabel: "OL ATK",
    placements: spread("o a", ["extraDeckCard"]),
    section: CARD,
  },
  {
    action: "OL DEF",
    kind: "cardMenu",
    menuLabel: "OL DEF",
    placements: spread("o d", ["extraDeckCard"]),
    section: CARD,
  },
  {
    action: "Flip Summon",
    kind: "cardMenu",
    menuLabel: "Flip Summon",
    placements: spread("f", ["fieldMonsterFaceDown"]),
    section: CARD,
  },
  {
    action: "Flip",
    kind: "cardMenu",
    menuLabel: "Flip",
    placements: spread("shift+f", ["fieldMonsterFaceDown"]),
    section: CARD,
  },
  {
    action: "To ATK",
    kind: "cardMenu",
    menuLabel: "To ATK",
    placements: spread("", ["fieldMonsterFaceUp"]),
    section: CARD,
  },
  {
    action: "To DEF",
    kind: "cardMenu",
    menuLabel: "To DEF",
    placements: spread("", ["fieldMonsterFaceUp"]),
    section: CARD,
  },
  {
    action: "Attack",
    kind: "cardMenu",
    menuLabel: "Attack",
    placements: spread("a", ["fieldMonsterFaceUp"]),
    section: CARD,
  },
  {
    action: "Attack Directly",
    kind: "cardMenu",
    menuLabel: "Attack Directly",
    // Deliberate warning-level share with Attack: when both labels show,
    // Attack (earlier in the catalog) acts; when the opponent's field is
    // empty only Attack Directly is offered, so "a" always attacks.
    placements: spread("a", ["fieldMonsterFaceUp"]),
    section: CARD,
  },
  {
    action: "Overlay",
    kind: "cardMenu",
    menuLabel: "Overlay",
    placements: spread("o", ["fieldMonsterFaceUp"]),
    section: CARD,
  },
  {
    action: "Move",
    kind: "cardMenu",
    menuLabel: "Move",
    placements: spread("m", [
      "fieldMonsterFaceUp",
      "fieldMonsterFaceDown",
      "fieldST",
    ]),
    section: CARD,
  },
  {
    action: "Activate Left",
    kind: "cardMenu",
    menuLabel: "Activate Left",
    placements: spread("", [
      "handMonster",
      "fieldMonsterFaceUp",
      "fieldST",
      "graveCard",
      "banishedCard",
      "extraDeckCard",
      "deckViewCard",
    ]),
    section: CARD,
  },
  {
    action: "Activate Right",
    kind: "cardMenu",
    menuLabel: "Activate Right",
    placements: spread("", [
      "handMonster",
      "fieldMonsterFaceUp",
      "fieldST",
      "graveCard",
      "banishedCard",
      "extraDeckCard",
      "deckViewCard",
    ]),
    section: CARD,
  },
  {
    action: "Declare",
    kind: "cardMenu",
    menuLabel: "Declare",
    placements: spread("d", [
      "handMonster",
      "handST",
      "fieldMonsterFaceUp",
      "fieldST",
      "graveCard",
      "banishedCard",
      "extraDeckCard",
    ]),
    section: CARD,
  },
  {
    action: "To Hand",
    kind: "cardMenu",
    menuLabel: "To Hand",
    placements: spread("t h", [
      "fieldMonsterFaceUp",
      "fieldMonsterFaceDown",
      "fieldST",
      "graveCard",
      "banishedCard",
      "deckViewCard",
    ]),
    section: CARD,
  },
  {
    action: "To Extra Deck",
    kind: "cardMenu",
    menuLabel: "To Extra Deck",
    placements: spread("t e", [
      "fieldMonsterFaceUp",
      "fieldMonsterFaceDown",
      "graveCard",
      "banishedCard",
    ]),
    section: CARD,
  },
  {
    action: "To Extra Deck FU",
    kind: "cardMenu",
    menuLabel: "To Extra Deck FU",
    placements: spread("t shift+e", [
      "fieldMonsterFaceUp",
      "fieldST",
      "graveCard",
      "banishedCard",
    ]),
    section: CARD,
  },
  {
    action: "To Graveyard",
    kind: "cardMenu",
    menuLabel: "To Graveyard",
    placements: spread("t g", [
      "handMonster",
      "handST",
      "fieldMonsterFaceUp",
      "fieldMonsterFaceDown",
      "fieldST",
    ]),
    section: CARD,
  },
  {
    action: "To Grave",
    kind: "cardMenu",
    menuLabel: "To Grave",
    placements: spread("t g", [
      "banishedCard",
      "extraDeckCard",
      "deckViewCard",
      "opponentCard",
    ]),
    section: CARD,
  },
  {
    action: "Detach",
    kind: "cardMenu",
    menuLabel: "Detach",
    placements: spread("d", ["xyzMaterial"]),
    section: CARD,
  },
  {
    action: "Banish",
    kind: "cardMenu",
    menuLabel: "Banish",
    placements: spread("t b", [
      "handMonster",
      "handST",
      "fieldMonsterFaceUp",
      "fieldMonsterFaceDown",
      "fieldST",
      "graveCard",
      "extraDeckCard",
      "deckViewCard",
      "xyzMaterial",
      "opponentCard",
    ]),
    section: CARD,
  },
  {
    action: "Banish FD",
    kind: "cardMenu",
    menuLabel: "Banish FD",
    placements: spread("t shift+b", [
      "handMonster",
      "handST",
      "fieldMonsterFaceUp",
      "fieldMonsterFaceDown",
      "fieldST",
      "graveCard",
      "extraDeckCard",
      "deckViewCard",
    ]),
    section: CARD,
  },
  {
    action: "To Top of Deck",
    kind: "cardMenu",
    menuLabel: "To Top of Deck",
    placements: spread("t d", [
      "handMonster",
      "handST",
      "fieldMonsterFaceUp",
      "fieldMonsterFaceDown",
      "fieldST",
    ]),
    section: CARD,
  },
  {
    action: "To T. Deck",
    kind: "cardMenu",
    menuLabel: "To T. Deck",
    placements: spread("t d", ["graveCard", "banishedCard"]),
    section: CARD,
  },
  {
    action: "To Bottom of Deck",
    kind: "cardMenu",
    menuLabel: "To Bottom of Deck",
    placements: spread("t shift+d", [
      "handMonster",
      "handST",
      "fieldMonsterFaceUp",
      "fieldMonsterFaceDown",
      "fieldST",
    ]),
    section: CARD,
  },
  {
    action: "To B. Deck",
    kind: "cardMenu",
    menuLabel: "To B. Deck",
    placements: spread("t shift+d", ["graveCard", "banishedCard"]),
    section: CARD,
  },
  {
    action: "Target",
    kind: "cardMenu",
    menuLabel: "Target",
    placements: spread("shift+t", [
      "fieldMonsterFaceUp",
      "fieldMonsterFaceDown",
      "fieldST",
      "graveCard",
      "banishedCard",
      "opponentCard",
    ]),
    section: CARD,
  },
  {
    action: "Attach",
    kind: "cardMenu",
    menuLabel: "Attach",
    placements: spread("a", ["graveCard", "banishedCard", "opponentCard"]),
    section: CARD,
  },
  {
    action: "Reveal",
    kind: "cardMenu",
    menuLabel: "Reveal",
    placements: spread("r", [
      "handMonster",
      "handST",
      "extraDeckCard",
      "deckViewCard",
    ]),
    section: CARD,
  },
  {
    action: "Stop Revealing",
    kind: "cardMenu",
    menuLabel: "Stop Revealing",
    placements: spread("", [
      "handMonster",
      "handST",
      "extraDeckCard",
      "deckViewCard",
    ]),
    section: CARD,
  },
  {
    action: "Stay Revealed",
    kind: "cardMenu",
    menuLabel: "Stay Revealed",
    placements: spread("", [
      "handMonster",
      "handST",
      "extraDeckCard",
      "deckViewCard",
    ]),
    section: CARD,
  },
  {
    action: "Remove",
    kind: "cardMenu",
    menuLabel: "Remove",
    placements: spread("", ["fieldMonsterFaceUp"]),
    section: CARD,
  },
  {
    action: "Resolve Effect",
    kind: "cardMenu",
    menuLabel: "Resolve Effect",
    placements: spread("", [
      "fieldMonsterFaceUp",
      "fieldST",
      "graveCard",
      "banishedCard",
    ]),
    section: CARD,
  },
  {
    action: "Choose",
    kind: "cardMenu",
    menuLabel: "Choose",
    placements: spread("", ["deckViewCard"]),
    section: CARD,
  },

  // ── Global: mills / LP / emotes / extension ──────────────────────────
  // Mill chat commands ship unbound: "Mill Deck" on the pile covers
  // milling, and a global "m N" would block the pile groups' "m" keys.
  {
    action: "Mill 1",
    kind: "global",
    placements: globalPlacement(""),
    section: MILLS,
  },
  {
    action: "Mill 2",
    kind: "global",
    placements: globalPlacement(""),
    section: MILLS,
  },
  {
    action: "Mill 3",
    kind: "global",
    placements: globalPlacement(""),
    section: MILLS,
  },
  {
    action: "Mill 4",
    kind: "global",
    placements: globalPlacement(""),
    section: MILLS,
  },
  {
    action: "Mill 5",
    kind: "global",
    placements: globalPlacement(""),
    section: MILLS,
  },
  {
    action: "Mill 6",
    kind: "global",
    placements: globalPlacement(""),
    section: MILLS,
  },
  {
    action: "Sub LP",
    kind: "global",
    placements: globalPlacement("-"),
    section: LP,
  },
  {
    action: "Add LP",
    kind: "global",
    placements: globalPlacement("+"),
    section: LP,
  },
  {
    action: "Toggle Chat Box",
    kind: "global",
    placements: globalPlacement("enter"),
    section: EMOTES,
    locked: true,
  },
  {
    action: "Think",
    kind: "global",
    placements: globalPlacement(""),
    section: EMOTES,
  },
  {
    action: "Thumbs Up",
    kind: "global",
    placements: globalPlacement(""),
    section: EMOTES,
  },
  {
    action: "Show Hotkey Hints",
    kind: "global",
    placements: globalPlacement("f1"),
    section: EXTENSION,
  },

  // ── Replay viewer (duelingbook.com/replay) ───────────────────────────
  // These drive the extension's replay controls (src/replay_main.ts, a
  // MAIN-world script) and only match on /replay pages, so their keys are
  // free to differ from every duel group.
  {
    action: "Play/Pause Replay",
    kind: "replay",
    placements: replayPlacement("space"),
    section: REPLAY,
  },
  {
    action: "Step Backward",
    kind: "replay",
    placements: replayPlacement("arrowleft"),
    section: REPLAY,
  },
  {
    action: "Next Play",
    kind: "replay",
    placements: replayPlacement("arrowright"),
    section: REPLAY,
  },
  {
    action: "Speed Up",
    kind: "replay",
    placements: replayPlacement("arrowup"),
    section: REPLAY,
  },
  {
    action: "Speed Down",
    kind: "replay",
    placements: replayPlacement("arrowdown"),
    section: REPLAY,
  },
  {
    action: "Previous Turn",
    kind: "replay",
    placements: replayPlacement("["),
    section: REPLAY,
  },
  {
    action: "Next Turn",
    kind: "replay",
    placements: replayPlacement("]"),
    section: REPLAY,
  },
  {
    action: "Jump to Game 1",
    kind: "replay",
    placements: replayPlacement("g 1"),
    section: REPLAY,
  },
  {
    action: "Jump to Game 2",
    kind: "replay",
    placements: replayPlacement("g 2"),
    section: REPLAY,
  },
  {
    action: "Jump to Game 3",
    kind: "replay",
    placements: replayPlacement("g 3"),
    section: REPLAY,
  },
];

/*
 * Labels deliberately NOT in the catalog (duel.js v926) — all gated behind
 * `findCard([...])` for specific cards, moderator flags, or debug modes.
 * Revisit when re-auditing a new duel.js version:
 *   To Opponent's Hand, Set to Monster Zone, Set to other side,
 *   Activate to other side, Swap (mod), Look at cards, Look at top card,
 *   Look at opponent cards, Check Options, Banish 3/8/10 Cards (FD),
 *   Banish 3/6 ED Cards FD, Banish random (FD) ED Card, Mill 3 Cards,
 *   Mill <n> (deck-difference), To Top of Deck face-up, Turn Top Card FU,
 *   Banish B., Flip Deck, Card of Fate Effect, To S/T on opponent cards
 *   (Toadally Awesome), Choose-variants for the opponent, This is
 *   backwards/This looks right (debug), and automatic-duel mode
 *   (cardMenuE2).
 */

const indexByAction = new Map(
  actionCatalog.map((entry, index) => [entry.action, index]),
);

export function getCatalogEntry(action: string): CatalogEntry | undefined {
  const index = indexByAction.get(action);
  return index === undefined ? undefined : actionCatalog[index];
}

/** Catalog position; unknown actions sort after every known one. */
export function catalogIndex(action: string): number {
  return indexByAction.get(action) ?? actionCatalog.length;
}

export function getPlacement(
  action: string,
  context: ContextGroup,
): Placement | undefined {
  return getCatalogEntry(action)?.placements.find(
    (placement) => placement.context === context,
  );
}

/**
 * cardMenu label → the card groups whose menu can contain it. Feeds the
 * context-detection fingerprint.
 */
export function buildCardLabelIndex(): Map<string, Set<ContextTag>> {
  const index = new Map<string, Set<ContextTag>>();
  for (const entry of actionCatalog) {
    if (entry.kind !== "cardMenu" || !entry.menuLabel) continue;
    let groups = index.get(entry.menuLabel);
    if (!groups) {
      groups = new Set();
      index.set(entry.menuLabel, groups);
    }
    for (const placement of entry.placements) {
      groups.add(placement.context as ContextTag);
    }
  }
  return index;
}
