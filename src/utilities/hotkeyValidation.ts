import { HotkeyEntry, parseSequence } from "./configUtility";

export interface SequenceConflict {
  action: string;
  hotkey: string;
}

function isPrefixOrEqual(a: string[], b: string[]): boolean {
  if (a.length > b.length) return false;
  return a.every((key, i) => key === b[i]);
}

/**
 * A candidate binding conflicts with an existing one when either sequence is
 * a prefix of (or equal to) the other — the matcher could never distinguish
 * them. Entries whose action belongs to the group being edited are exempt:
 * compound rows ("To Hand/To Extra Deck") intentionally share one binding.
 */
export function findSequenceConflict(
  candidate: string[],
  editedActions: string[],
  entries: HotkeyEntry[],
): SequenceConflict | null {
  if (candidate.length === 0) return null;

  for (const entry of entries) {
    if (editedActions.includes(entry.action)) continue;
    const existing = parseSequence(entry.hotkey);
    if (existing.length === 0) continue;
    if (
      isPrefixOrEqual(candidate, existing) ||
      isPrefixOrEqual(existing, candidate)
    ) {
      return { action: entry.action, hotkey: entry.hotkey };
    }
  }
  return null;
}
