import {
  actionCatalog,
  catalogIndex,
  getCatalogEntry,
  getPlacement,
  ContextGroup,
} from "../data/actionCatalog";
import {
  ContextHotkeyEntry,
  HotkeyEntry,
  parseSequence,
} from "./hotkeySequence";
import { findConflicts, hardConflicts } from "./hotkeyValidation";

export { parseSequence, formatSequence } from "./hotkeySequence";
export type { HotkeyEntry, ContextHotkeyEntry } from "./hotkeySequence";

/**
 * Storage format: sparse overrides — only rows the user changed. A fully
 * expanded config (~140 rows) exceeds chrome.storage.sync's 8KB per-item
 * quota, and sparseness lets improved defaults reach users on upgrade
 * unless they customized that exact row.
 */
export type HotkeyOverridesV2 = Partial<
  Record<ContextGroup, Record<string, { hotkey?: string; disabled?: boolean }>>
>;

/** All placements at their catalog defaults, in catalog order. */
export function getDefaultRows(): ContextHotkeyEntry[] {
  const rows: ContextHotkeyEntry[] = [];
  for (const entry of actionCatalog) {
    for (const placement of entry.placements) {
      rows.push({
        context: placement.context,
        action: entry.action,
        hotkey: placement.defaultHotkey,
        disabled: false,
      });
    }
  }
  return rows;
}

/**
 * Defaults + overrides → full rows. Overrides addressing unknown
 * placements are dropped (prunes rows whose action/context left the
 * catalog); locked entries ignore overrides. An upgrade-safety pass then
 * blanks any still-default enabled row that conflicts (equal/prefix, in
 * its scope) with a user-overridden row — a new shipped default must
 * never break or shadow keys the user chose. Blanking applies even to
 * warning-level (equal-key) collisions: shipped defaults always yield to
 * user keys, while users may still create such shares themselves.
 * (Default-vs-default conflicts can't exist; the catalog invariant test
 * guarantees it.)
 */
export function expandOverrides(
  overrides: HotkeyOverridesV2,
): ContextHotkeyEntry[] {
  const rows = getDefaultRows();
  const userBound: ContextHotkeyEntry[] = [];
  for (const row of rows) {
    if (getCatalogEntry(row.action)?.locked) continue;
    const override = overrides[row.context]?.[row.action];
    if (!override) continue;
    if (override.hotkey !== undefined) {
      row.hotkey = override.hotkey;
      userBound.push(row);
    }
    if (override.disabled !== undefined) row.disabled = override.disabled;
  }
  for (const row of rows) {
    if (row.disabled || row.hotkey === "") continue;
    if (overrides[row.context]?.[row.action]?.hotkey !== undefined) continue;
    if (
      findConflicts(
        parseSequence(row.hotkey),
        row.context,
        row.action,
        userBound,
      ).length > 0
    ) {
      row.hotkey = "";
    }
  }
  return rows;
}

/**
 * Inverse of expandOverrides for persistence: emit only deviations from
 * the catalog defaults, so un-customizing a row shrinks storage and Reset
 * Defaults stores `{}`.
 */
export function diffAgainstDefaults(
  rows: ContextHotkeyEntry[],
): HotkeyOverridesV2 {
  const overrides: HotkeyOverridesV2 = {};
  for (const row of rows) {
    const placement = getPlacement(row.action, row.context);
    if (!placement || getCatalogEntry(row.action)?.locked) continue;
    const override: { hotkey?: string; disabled?: boolean } = {};
    if (row.hotkey !== placement.defaultHotkey) override.hotkey = row.hotkey;
    if (row.disabled) override.disabled = true;
    if (override.hotkey === undefined && override.disabled === undefined)
      continue;
    (overrides[row.context] ??= {})[row.action] = override;
  }
  return overrides;
}

/**
 * Best-effort migration of the pre-context config (one binding per
 * action): fan each stored binding out to every placement of its action.
 * Two passes — global/pile placements first, then card placements — so
 * migrated always-on keys are in place before card groups validate
 * against them. A placement where the old key would conflict keeps its
 * default instead.
 */
export function migrateV1(v1: HotkeyEntry[]): HotkeyOverridesV2 {
  const overrides: HotkeyOverridesV2 = {};
  const working = getDefaultRows();
  const record = (
    context: ContextGroup,
    action: string,
    patch: { hotkey?: string; disabled?: boolean },
  ) => {
    const forContext = (overrides[context] ??= {});
    forContext[action] = { ...forContext[action], ...patch };
  };

  const passes: Array<(kind: string) => boolean> = [
    (kind) => kind !== "cardMenu",
    (kind) => kind === "cardMenu",
  ];
  for (const pass of passes) {
    for (const entry of actionCatalog) {
      if (!pass(entry.kind) || entry.locked) continue;
      const stored = v1.find((item) => item.action === entry.action);
      if (!stored) continue;
      for (const placement of entry.placements) {
        const row = working.find(
          (item) =>
            item.context === placement.context && item.action === entry.action,
        )!;
        if (stored.disabled) {
          row.disabled = true;
          record(placement.context, entry.action, { disabled: true });
        }
        if (stored.hotkey === placement.defaultHotkey) continue;
        if (
          hardConflicts(
            findConflicts(
              parseSequence(stored.hotkey),
              placement.context,
              entry.action,
              working,
            ),
          ).length > 0
        ) {
          continue; // keep the default in this placement
        }
        row.hotkey = stored.hotkey;
        record(placement.context, entry.action, { hotkey: stored.hotkey });
      }
    }
  }
  return overrides;
}

// Row order is fire order when an ambiguous-context (merged) matcher
// yields several actions for one key, so pin it to catalog order.
export function sortByCatalogOrder(
  rows: ContextHotkeyEntry[],
): ContextHotkeyEntry[] {
  const placementIndex = (row: ContextHotkeyEntry) => {
    const entry = getCatalogEntry(row.action);
    if (!entry) return 0;
    const index = entry.placements.findIndex(
      (placement) => placement.context === row.context,
    );
    return index < 0 ? entry.placements.length : index;
  };
  return [...rows].sort(
    (a, b) =>
      catalogIndex(a.action) - catalogIndex(b.action) ||
      placementIndex(a) - placementIndex(b),
  );
}

export async function loadHotkeysConfig(): Promise<ContextHotkeyEntry[]> {
  return new Promise<ContextHotkeyEntry[]>((resolve) => {
    chrome.storage.sync.get(
      { hotkeysConfigV2: null, hotkeysConfig: [] },
      (data) => {
        if (data.hotkeysConfigV2) {
          resolve(sortByCatalogOrder(expandOverrides(data.hotkeysConfigV2)));
        } else if (data.hotkeysConfig.length > 0) {
          const overrides = migrateV1(data.hotkeysConfig);
          chrome.storage.sync.set({ hotkeysConfigV2: overrides });
          chrome.storage.sync.remove("hotkeysConfig");
          resolve(sortByCatalogOrder(expandOverrides(overrides)));
        } else {
          resolve(getDefaultRows());
        }
      },
    );
  });
}

export async function saveHotkeysConfig(
  unordered: ContextHotkeyEntry[],
): Promise<void> {
  const rows = sortByCatalogOrder(unordered);
  const overrides = diffAgainstDefaults(rows);
  return new Promise<void>((resolve) => {
    chrome.storage.sync.set({ hotkeysConfigV2: overrides }, () => {
      // notify content scripts that hotkeys have changed; the payload is
      // the expanded rows so receivers don't re-read storage
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id !== undefined) {
            chrome.tabs.sendMessage(
              tab.id,
              {
                type: "HOTKEYS_CHANGED",
                payload: rows,
              },
              () => {
                // only DuelingBook tabs have a receiver; reading lastError
                // swallows the "Receiving end does not exist" rejection
                // for every other tab
                void chrome.runtime.lastError;
              },
            );
          }
        }
      });
      resolve();
    });
  });
}
