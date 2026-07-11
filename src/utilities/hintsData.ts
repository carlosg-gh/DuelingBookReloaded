import { HotkeyEntry } from "./configUtility";
import { hotkeySections } from "../data/hotkeySections";
import { splitActions } from "./actionsManipulations";

export interface HintRow {
  // the options-page row label, e.g. "To Hand/To Extra Deck"
  label: string;
  hotkey: string;
  // underlying action names, for prefix-narrowing lookups
  actions: string[];
}

export interface HintGroup {
  title: string;
  rows: HintRow[];
}

/**
 * Enabled bindings grouped and ordered like the options page. Compound
 * labels resolve to the single binding their actions share.
 */
export function buildHintGroups(entries: HotkeyEntry[]): HintGroup[] {
  const groups: HintGroup[] = [];

  for (const section of hotkeySections) {
    const rows: HintRow[] = [];
    for (const label of section.actions) {
      const actions = splitActions(label);
      const entry = entries.find((item) => actions.includes(item.action));
      if (!entry || entry.disabled || entry.hotkey.length === 0) continue;
      rows.push({ label, hotkey: entry.hotkey, actions });
    }
    if (rows.length > 0) {
      groups.push({ title: section.title, rows });
    }
  }

  return groups;
}
