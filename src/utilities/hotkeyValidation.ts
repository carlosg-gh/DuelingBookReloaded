import { ContextHotkeyEntry, parseSequence } from "./hotkeySequence";
import { ContextGroup } from "../data/actionCatalog";

export type ConflictSeverity = "hard" | "warning";

export interface SequenceConflict {
  context: ContextGroup;
  action: string;
  hotkey: string;
  reason: "equal" | "prefix";
  severity: ConflictSeverity;
}

function isPrefixOrEqual(a: string[], b: string[]): boolean {
  if (a.length > b.length) return false;
  return a.every((key, i) => key === b[i]);
}

function equalSequences(a: string[], b: string[]): boolean {
  return a.length === b.length && isPrefixOrEqual(a, b);
}

/**
 * Conflicts between a candidate binding for (context, editedAction) and
 * the existing enabled rows. Bindings only compete inside their own
 * group — matching is context-scoped at runtime, so a key or prefix used
 * in another group is free. The Global group fires everywhere, so it
 * competes with every group (in both directions).
 *
 * Severity:
 * - "hard" (blocked): prefix relations — within one matcher the shorter
 *   binding fires immediately and the longer one is unreachable — and
 *   anything involving the Global group (its actions run
 *   unconditionally, so an equal key would double-fire).
 * - "warning" (allowed): equal keys between two actions of the same
 *   non-global group. Both fire; each handler clicks only if its label
 *   is in the menu, and when a menu offers both labels the action
 *   earlier in the catalog acts.
 *
 * Disabled rows are exempt (re-enabling re-validates).
 */
export function findConflicts(
  candidate: string[],
  context: ContextGroup,
  editedAction: string,
  rows: ContextHotkeyEntry[],
): SequenceConflict[] {
  if (candidate.length === 0) return [];

  const conflicts: SequenceConflict[] = [];
  for (const row of rows) {
    if (row.disabled) continue;
    if (row.context === context && row.action === editedAction) continue;
    const inScope =
      context === "global" ||
      row.context === context ||
      row.context === "global";
    if (!inScope) continue;
    const existing = parseSequence(row.hotkey);
    if (existing.length === 0) continue;

    if (equalSequences(candidate, existing)) {
      const involvesGlobal = context === "global" || row.context === "global";
      conflicts.push({
        context: row.context,
        action: row.action,
        hotkey: row.hotkey,
        reason: "equal",
        severity: involvesGlobal ? "hard" : "warning",
      });
    } else if (
      isPrefixOrEqual(candidate, existing) ||
      isPrefixOrEqual(existing, candidate)
    ) {
      conflicts.push({
        context: row.context,
        action: row.action,
        hotkey: row.hotkey,
        reason: "prefix",
        severity: "hard",
      });
    }
  }
  return conflicts;
}

export function hardConflicts(
  conflicts: SequenceConflict[],
): SequenceConflict[] {
  return conflicts.filter((conflict) => conflict.severity === "hard");
}
