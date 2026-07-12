import { ContextHotkeyEntry } from "./hotkeySequence";
import { GROUP_ORDER, GROUP_LABELS, ContextGroup } from "../data/actionCatalog";

export interface HintRow {
  label: string;
  hotkey: string;
  // underlying action names, for prefix-narrowing lookups
  actions: string[];
}

export interface HintGroup {
  context: ContextGroup;
  title: string;
  rows: HintRow[];
}

/**
 * Enabled, bound rows grouped by context group in GROUP_ORDER (matching
 * the options page). Within a group duplicates are impossible (validation
 * hard-blocks them), so every row is a single action.
 */
export function buildHintGroups(rows: ContextHotkeyEntry[]): HintGroup[] {
  const groups: HintGroup[] = [];
  for (const context of GROUP_ORDER) {
    const hintRows: HintRow[] = rows
      .filter(
        (row) =>
          row.context === context && !row.disabled && row.hotkey.length > 0,
      )
      .map((row) => ({
        label: row.action,
        hotkey: row.hotkey,
        actions: [row.action],
      }));
    if (hintRows.length > 0) {
      groups.push({ context, title: GROUP_LABELS[context], rows: hintRows });
    }
  }
  return groups;
}
