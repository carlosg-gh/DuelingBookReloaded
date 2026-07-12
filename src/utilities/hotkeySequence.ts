// Sequence primitives, kept dependency-free so both configUtility and
// hotkeyValidation can use them without importing each other.

import type { ContextGroup } from "../data/actionCatalog";

export interface HotkeyEntry {
  action: string;
  // A single key ("v") or a space-separated key sequence ("v e").
  hotkey: string;
  disabled: boolean;
}

// One binding row: (context group, action). Extends HotkeyEntry so the
// SequenceMatcher and HotkeyRecorder consume rows unchanged.
export interface ContextHotkeyEntry extends HotkeyEntry {
  context: ContextGroup;
}

export function parseSequence(hotkey: string): string[] {
  return hotkey.split(" ").filter((key) => key.length > 0);
}

export function formatSequence(keys: string[]): string {
  return keys.join(" ");
}
