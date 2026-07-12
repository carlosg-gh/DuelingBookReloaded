import {
  actionCatalog,
  GROUP_ORDER,
  GROUP_LABELS,
  ContextGroup,
} from "./actionCatalog";

export interface SectionRow {
  action: string;
  /** Subhead label — only rendered inside the Global section. */
  subhead?: string;
}

export interface HotkeySectionData {
  context: ContextGroup;
  title: string;
  note: string | null;
  rows: SectionRow[];
}

const GROUP_NOTES: Partial<Record<ContextGroup, string>> = {
  global:
    "Note: These work anywhere. View hotkeys close their view when pressed again.",
  mainPile: "Note: These act while your mouse is over your deck.",
  extraPile: "Note: These act while your mouse is over your Extra Deck.",
  handMonster:
    "Note: While hovering a monster in your hand. If DuelingBook shows the same menu for a monster and a spell/trap, keep shared actions on the same key in both hand groups.",
  handST: "Note: While hovering a spell or trap in your hand.",
  fieldMonsterFaceUp: "Note: While hovering your face-up monster.",
  fieldMonsterFaceDown: "Note: While hovering your face-down monster.",
  fieldST: "Note: While hovering your set/face-up spells & traps.",
  graveCard: "Note: Cards in your graveyard (pile top or the GY view).",
  banishedCard: "Note: Your banished cards (pile top or the view).",
  deckViewCard: "Note: Cards while viewing or picking from your deck.",
  extraDeckCard: "Note: Cards while viewing your Extra Deck.",
  xyzMaterial: "Note: Materials while viewing an Xyz monster's materials.",
  opponentCard: "Note: Cards in your opponent's graveyard/banished views.",
};

// One options-page/hints section per context group, in GROUP_ORDER, rows
// in catalog order.
export const hotkeySections: HotkeySectionData[] = GROUP_ORDER.map(
  (context) => ({
    context,
    title: GROUP_LABELS[context],
    note: GROUP_NOTES[context] ?? null,
    rows: actionCatalog
      .filter((entry) =>
        entry.placements.some((placement) => placement.context === context),
      )
      .map((entry) => ({
        action: entry.action,
        subhead: context === "global" ? entry.section : undefined,
      })),
  }),
);
