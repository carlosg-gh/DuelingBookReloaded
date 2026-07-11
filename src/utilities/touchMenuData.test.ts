import { buildFanModel, resolveTouchActive } from "./touchMenuData";

describe("buildFanModel", () => {
  it("keeps top-level labels as direct actions", () => {
    const items = buildFanModel([
      "Activate",
      "Attack",
      "Attack Directly",
      "Target",
      "Declare",
      "View",
      "Detach",
      "Attach",
      "Resolve Effect",
    ]);
    expect(items).toEqual(
      [
        "Activate",
        "Attack",
        "Attack Directly",
        "Target",
        "Declare",
        "View",
        "Detach",
        "Attach",
        "Resolve Effect",
      ].map((label) => ({ kind: "action", label })),
    );
  });

  it("groups a hand card's menu and preserves order", () => {
    // the 13 labels a hand monster actually offered, in native menu order
    const items = buildFanModel([
      "Reveal",
      "Declare",
      "To S/T",
      "To Bottom of Deck",
      "To Top of Deck",
      "Banish FD",
      "Banish",
      "To Graveyard",
      "S. Summon DEF",
      "S. Summon ATK",
      "Set",
      "Normal Summon",
      "Activate",
    ]);
    expect(items).toEqual([
      { kind: "action", label: "Reveal" }, // single-member Reveal group promoted
      { kind: "action", label: "Declare" },
      {
        kind: "group",
        group: "Send To",
        children: [
          "To S/T",
          "To Bottom of Deck",
          "To Top of Deck",
          "Banish FD",
          "Banish",
          "To Graveyard",
        ],
      },
      {
        kind: "group",
        group: "Summon",
        children: ["S. Summon DEF", "S. Summon ATK", "Set", "Normal Summon"],
      },
      { kind: "action", label: "Activate" },
    ]);
  });

  it("promotes single-member groups to direct actions", () => {
    const items = buildFanModel(["View", "To Grave"]);
    expect(items).toEqual([
      { kind: "action", label: "View" },
      { kind: "action", label: "To Grave" },
    ]);
  });

  it("keeps unknown labels at the top level, in place", () => {
    const items = buildFanModel(["Normal Summon", "Some Future Action", "Set"]);
    expect(items).toEqual([
      {
        kind: "group",
        group: "Summon",
        children: ["Normal Summon", "Set"],
      },
      { kind: "action", label: "Some Future Action" },
    ]);
  });

  it("never splits labels containing slashes", () => {
    // "To S/T" is Send To, "Set (To S/T)" is Summon — both single → promoted
    expect(buildFanModel(["To S/T", "Set (To S/T)"])).toEqual([
      { kind: "action", label: "To S/T" },
      { kind: "action", label: "Set (To S/T)" },
    ]);
  });

  it("groups pile-context menus with View/Draw/Shuffle direct and Move fanned", () => {
    // the main deck's actual menu, in native order
    const items = buildFanModel(
      ["View", "Banish FD", "Banish T.", "Mill", "Shuffle", "Draw"],
      "pile",
    );
    expect(items).toEqual([
      { kind: "action", label: "View" },
      {
        kind: "group",
        group: "Move",
        children: ["Banish FD", "Banish T.", "Mill"],
      },
      { kind: "action", label: "Shuffle" },
      { kind: "action", label: "Draw" },
    ]);
  });

  it("uses card grouping for the same labels in card context", () => {
    // "Banish FD" on a card means banish THIS card — Send To group, and a
    // lone member is promoted to a direct action
    expect(buildFanModel(["Banish FD", "To Graveyard"])).toEqual([
      {
        kind: "group",
        group: "Send To",
        children: ["Banish FD", "To Graveyard"],
      },
    ]);
  });

  it("handles an empty menu", () => {
    expect(buildFanModel([])).toEqual([]);
  });
});

describe("resolveTouchActive", () => {
  it.each([
    ["on", true, true],
    ["on", false, true],
    ["off", true, false],
    ["off", false, false],
    ["auto", true, true],
    ["auto", false, false],
  ] as const)("mode %s with coarse=%s → %s", (mode, coarse, expected) => {
    expect(resolveTouchActive(mode, coarse)).toBe(expected);
  });
});
