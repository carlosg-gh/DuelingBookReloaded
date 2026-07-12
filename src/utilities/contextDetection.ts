/**
 * Decide which binding group(s) the pressed key should be matched
 * against, from a snapshot of DuelingBook's DOM. Pure — the content
 * script gathers the snapshot with a handful of synchronous reads.
 *
 * Returns a candidate LIST: usually one group, several when a card menu
 * is genuinely ambiguous (e.g. with all zones full, a hand monster and a
 * hand trap can produce identical menus). The caller matches against the
 * merged bindings of all candidates; handlers are label-checked, so an
 * over-broad candidate set can only add no-ops, never wrong clicks.
 */

import { ContextTag, buildCardLabelIndex } from "../data/actionCatalog";
import { isPileMenuLabels } from "./touchMenuData";

export interface DetectionSnapshot {
  /** readMenuLabels(); [] = no menu open. */
  menuLabels: string[];
  /** "#view .title_txt" text when the view window is visible, else null. */
  viewTitle: string | null;
  /** The pointer's hovered card sits inside the #view window. */
  pointerCardInView: boolean;
  /** Pointer is inside #deck_hidden / #extra_hidden. */
  pointerOverMainPile: boolean;
  pointerOverExtraPile: boolean;
}

const CARD_LABEL_INDEX = buildCardLabelIndex();

/**
 * Map a view window title to the group its card rows belong to. Titles
 * come from DuelingBook's `viewingE` ("Viewing " + name); unknown views
 * (opponent's hand/deck, shuffle pickers, Paused Game) return null — no
 * bindable card group exists for them.
 */
export function viewTitleGroup(title: string): ContextTag | null {
  const name = title.replace(/^Viewing /, "");
  if (name.startsWith("Opponent's Graveyard")) return "opponentCard";
  if (name.startsWith("Opponent's Banished")) return "opponentCard";
  if (name.startsWith("Opponent's")) return null;
  if (
    name.startsWith("Extra Deck") ||
    name.startsWith("Host's Public Extra Deck")
  )
    return "extraDeckCard";
  if (name.startsWith("Deck")) return "deckViewCard"; // incl. "(Picking N Cards)"
  if (name.startsWith("Graveyard")) return "graveCard";
  if (name.startsWith("Banished")) return "banishedCard";
  if (name.startsWith("Xyz Materials")) return "xyzMaterial";
  return null;
}

/**
 * Groups whose menus can contain every known label in this menu. Unknown
 * (card-gated) labels are ignored; if the known labels are contradictory
 * (catalog drift after a DuelingBook update), fall back to the union of
 * their groups rather than going dead.
 */
export function fingerprintCardMenu(labels: string[]): ContextTag[] {
  let intersection: Set<ContextTag> | null = null;
  const union = new Set<ContextTag>();
  for (const label of labels) {
    const groups = CARD_LABEL_INDEX.get(label);
    if (!groups) continue; // card-gated / unknown label
    for (const group of groups) union.add(group);
    if (intersection === null) {
      intersection = new Set(groups);
    } else {
      for (const group of intersection) {
        if (!groups.has(group)) intersection.delete(group);
      }
    }
  }
  if (intersection === null) return []; // no known labels at all
  if (intersection.size > 0) return [...intersection];
  console.debug(
    "[DBR] contradictory menu fingerprint — falling back to union:",
    labels,
  );
  return [...union];
}

export function detectContextGroups(snap: DetectionSnapshot): ContextTag[] {
  const menuOpen = snap.menuLabels.length > 0;

  if (menuOpen && isPileMenuLabels("main", snap.menuLabels))
    return ["mainPile"];
  if (menuOpen && isPileMenuLabels("extra", snap.menuLabels))
    return ["extraPile"];

  if (menuOpen && snap.viewTitle !== null && snap.pointerCardInView) {
    const group = viewTitleGroup(snap.viewTitle);
    return group ? [group] : [];
  }

  if (menuOpen) return fingerprintCardMenu(snap.menuLabels);

  // Pile menus drop after each action; hovering the pile is enough (the
  // pile handlers re-open the menu at fire time).
  if (snap.pointerOverMainPile) return ["mainPile"];
  if (snap.pointerOverExtraPile) return ["extraPile"];

  return [];
}
