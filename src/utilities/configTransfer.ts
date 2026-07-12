/**
 * Export/import of hotkey configurations as JSON. The payload is the same
 * sparse-override shape the extension stores (only deviations from the
 * catalog defaults), wrapped in a versioned envelope — files stay tiny,
 * and importing on a newer extension version inherits improved defaults
 * for every row the export didn't touch.
 */

import {
  actionCatalog,
  GROUP_LABELS,
  ContextGroup,
} from "../data/actionCatalog";
import {
  expandOverrides,
  diffAgainstDefaults,
  HotkeyOverridesV2,
} from "./configUtility";
import { ContextHotkeyEntry, parseSequence } from "./hotkeySequence";
import { findConflicts, hardConflicts } from "./hotkeyValidation";
import { isAssignableToken } from "./keyNormalization";

export const EXPORT_FORMAT = "dbr-hotkeys";
export const EXPORT_VERSION = 2;

export type ImportResult =
  | { ok: true; rows: ContextHotkeyEntry[]; dropped: string[] }
  | { ok: false; error: string };

export function serializeConfig(rows: ContextHotkeyEntry[]): string {
  return JSON.stringify(
    {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      overrides: diffAgainstDefaults(rows),
    },
    null,
    2,
  );
}

function isValidHotkey(hotkey: unknown): hotkey is string {
  return (
    typeof hotkey === "string" &&
    parseSequence(hotkey).every((token) => isAssignableToken(token))
  );
}

/**
 * Parse an exported file back into full rows. Forgiving like the V1
 * migration: entries unknown to this catalog, malformed, on locked
 * actions, or colliding with an already-accepted entry of the same group
 * are skipped and reported in `dropped`. Accepted overrides then expand
 * exactly like stored ones (`expandOverrides`) — in particular, an
 * imported key that collides with a shipped default wins and the default
 * goes unbound, just as it would after an upgrade. Only structural
 * problems (bad JSON, wrong envelope) reject the whole file.
 */
export function parseConfigImport(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "That file is not a hotkey export." };
  }
  const envelope = parsed as Record<string, unknown>;
  if (envelope.format !== EXPORT_FORMAT) {
    return { ok: false, error: "That file is not a hotkey export." };
  }
  if (envelope.version !== EXPORT_VERSION) {
    return {
      ok: false,
      error: `Unsupported export version (${String(envelope.version)}); this extension reads version ${EXPORT_VERSION}.`,
    };
  }
  if (typeof envelope.overrides !== "object" || envelope.overrides === null) {
    return { ok: false, error: "That file has no bindings in it." };
  }
  const raw = envelope.overrides as Record<
    string,
    Record<string, { hotkey?: unknown; disabled?: unknown }>
  >;

  const clean: HotkeyOverridesV2 = {};
  // Accepted rebinds, for override-vs-override conflict checks.
  const accepted: ContextHotkeyEntry[] = [];
  const dropped: string[] = [];
  const consumed = new Set<string>();
  const labelOf = (context: string, action: string) =>
    `${GROUP_LABELS[context as ContextGroup] ?? context}: ${action}`;

  // Two passes like migrateV1: always-on placements first so card groups
  // validate against the final global keys. Walking the catalog (not the
  // file) makes which of two colliding entries wins deterministic.
  const passes: Array<(kind: string) => boolean> = [
    (kind) => kind !== "cardMenu",
    (kind) => kind === "cardMenu",
  ];
  for (const pass of passes) {
    for (const entry of actionCatalog) {
      if (!pass(entry.kind)) continue;
      for (const placement of entry.placements) {
        const override = raw[placement.context]?.[entry.action];
        if (!override) continue;
        consumed.add(`${placement.context} ${entry.action}`);
        if (
          entry.locked ||
          typeof override !== "object" ||
          (override.hotkey !== undefined && !isValidHotkey(override.hotkey)) ||
          (override.disabled !== undefined &&
            typeof override.disabled !== "boolean")
        ) {
          dropped.push(labelOf(placement.context, entry.action));
          continue;
        }
        if (
          override.hotkey !== undefined &&
          override.disabled !== true &&
          hardConflicts(
            findConflicts(
              parseSequence(override.hotkey),
              placement.context,
              entry.action,
              accepted,
            ),
          ).length > 0
        ) {
          dropped.push(labelOf(placement.context, entry.action));
          continue;
        }
        const patch: { hotkey?: string; disabled?: boolean } = {};
        if (override.hotkey !== undefined) patch.hotkey = override.hotkey;
        if (override.disabled !== undefined) patch.disabled = override.disabled;
        (clean[placement.context] ??= {})[entry.action] = patch;
        if (override.hotkey !== undefined) {
          accepted.push({
            context: placement.context,
            action: entry.action,
            hotkey: override.hotkey,
            disabled: override.disabled === true,
          });
        }
      }
    }
  }

  // Entries addressing placements this catalog doesn't have.
  for (const [context, actions] of Object.entries(raw)) {
    if (typeof actions !== "object" || actions === null) {
      dropped.push(labelOf(context, "(malformed)"));
      continue;
    }
    for (const action of Object.keys(actions)) {
      if (!consumed.has(`${context} ${action}`)) {
        dropped.push(labelOf(context, action));
      }
    }
  }

  return { ok: true, rows: expandOverrides(clean), dropped };
}
