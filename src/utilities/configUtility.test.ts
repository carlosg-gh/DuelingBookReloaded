import {
  getDefaultRows,
  expandOverrides,
  diffAgainstDefaults,
  migrateV1,
  sortByCatalogOrder,
  HotkeyOverridesV2,
} from "./configUtility";
import { HotkeyEntry } from "./hotkeySequence";
import { actionCatalog } from "../data/actionCatalog";

// chrome.* is not needed: everything tested here is pure.

function hotkeyOf(
  rows: ReturnType<typeof getDefaultRows>,
  context: string,
  action: string,
) {
  return rows.find((row) => row.context === context && row.action === action)
    ?.hotkey;
}

describe("getDefaultRows / expandOverrides", () => {
  it("emits one row per catalog placement", () => {
    const placements = actionCatalog.reduce(
      (sum, entry) => sum + entry.placements.length,
      0,
    );
    expect(getDefaultRows()).toHaveLength(placements);
  });

  it("expands empty overrides to the defaults", () => {
    expect(expandOverrides({})).toEqual(getDefaultRows());
  });

  it("applies hotkey and disabled overrides to the right placement", () => {
    const rows = expandOverrides({
      mainPile: { Draw: { hotkey: "x" } },
      handMonster: { "Normal Summon": { disabled: true } },
    });
    expect(hotkeyOf(rows, "mainPile", "Draw")).toBe("x");
    expect(hotkeyOf(rows, "handMonster", "Declare")).toBe("d");
    expect(
      rows.find(
        (row) =>
          row.context === "handMonster" && row.action === "Normal Summon",
      )?.disabled,
    ).toBe(true);
  });

  it("drops overrides for unknown placements", () => {
    const overrides = {
      bogusContext: { Draw: { hotkey: "x" } },
      mainPile: { "Bogus Action": { hotkey: "x" } },
    } as unknown as HotkeyOverridesV2;
    expect(expandOverrides(overrides)).toEqual(getDefaultRows());
  });

  it("ignores overrides on locked actions", () => {
    const rows = expandOverrides({
      global: { "Close View Menu": { hotkey: "x", disabled: true } },
    });
    expect(hotkeyOf(rows, "global", "Close View Menu")).toBe("escape");
  });

  it("blanks a default that a user override collides with", () => {
    // User put Reveal on "n" in handMonster; the shipped Normal Summon
    // default ("n") must yield rather than double-fire.
    const rows = expandOverrides({
      handMonster: { Reveal: { hotkey: "n" } },
    });
    expect(hotkeyOf(rows, "handMonster", "Reveal")).toBe("n");
    expect(hotkeyOf(rows, "handMonster", "Normal Summon")).toBe("");
    // other groups untouched
    expect(hotkeyOf(rows, "handST", "Reveal")).toBe("r");
  });
});

describe("diffAgainstDefaults", () => {
  it("round-trips overrides through expand", () => {
    const overrides: HotkeyOverridesV2 = {
      mainPile: { Draw: { hotkey: "x" } },
      graveCard: { Banish: { hotkey: "", disabled: true } },
    };
    expect(diffAgainstDefaults(expandOverrides(overrides))).toEqual(overrides);
  });

  it("diffs the defaults to nothing", () => {
    expect(diffAgainstDefaults(getDefaultRows())).toEqual({});
  });
});

describe("migrateV1", () => {
  // A pre-context stored config: old default keys plus one custom bind.
  const v1: HotkeyEntry[] = [
    { action: "Think", hotkey: "t", disabled: false },
    { action: "Thumbs Up", hotkey: "f", disabled: false },
    { action: "Declare", hotkey: "d", disabled: false },
    { action: "Target", hotkey: "r", disabled: false },
    { action: "Overlay", hotkey: "shift+o", disabled: true },
    { action: "Long Gone Action", hotkey: "k", disabled: false },
  ];
  const overrides = migrateV1(v1);
  const rows = expandOverrides(overrides);

  it("skips a custom key that conflicts in scope", () => {
    // Think "t" (global) would prefix-collide with the "t …" card
    // bindings; Thumbs Up "f" would collide with Flip Summon.
    expect(hotkeyOf(rows, "global", "Think")).toBe("");
    expect(hotkeyOf(rows, "global", "Thumbs Up")).toBe("");
  });

  it("records nothing for default-equal bindings", () => {
    expect(overrides.handMonster?.["Declare"]).toBeUndefined();
    expect(hotkeyOf(rows, "handMonster", "Declare")).toBe("d");
  });

  it("fans a conflict-free custom key out to every placement", () => {
    // Target "r" is free in all of Target's groups (Reveal's "r" lives in
    // hand/view groups Target doesn't occupy).
    for (const placement of actionCatalog.find(
      (entry) => entry.action === "Target",
    )!.placements) {
      expect(hotkeyOf(rows, placement.context, "Target")).toBe("r");
    }
  });

  it("carries disabled flags", () => {
    expect(
      rows.find(
        (row) =>
          row.context === "fieldMonsterFaceUp" && row.action === "Overlay",
      )?.disabled,
    ).toBe(true);
  });

  it("drops unknown actions", () => {
    expect(JSON.stringify(overrides)).not.toContain("Long Gone Action");
  });
});

describe("sortByCatalogOrder", () => {
  it("orders rows by catalog position, then placement order", () => {
    const defaults = getDefaultRows();
    const shuffled = [...defaults].reverse();
    expect(sortByCatalogOrder(shuffled)).toEqual(defaults);
  });
});

describe("storage sizing", () => {
  it("documents why storage is sparse: the full config exceeds the quota", () => {
    const full = JSON.stringify({ hotkeysConfigV2Full: getDefaultRows() });
    expect(full.length).toBeGreaterThan(8192); // chrome.storage.sync per-item quota
  });
});
