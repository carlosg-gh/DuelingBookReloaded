import {
  detectContextGroups,
  fingerprintCardMenu,
  viewTitleGroup,
  DetectionSnapshot,
} from "./contextDetection";

function snap(partial: Partial<DetectionSnapshot>): DetectionSnapshot {
  return {
    menuLabels: [],
    viewTitle: null,
    pointerCardInView: false,
    pointerOverMainPile: false,
    pointerOverExtraPile: false,
    ...partial,
  };
}

describe("viewTitleGroup", () => {
  it.each([
    ["Viewing Graveyard", "graveCard"],
    ["Viewing Banished", "banishedCard"],
    ["Viewing Deck", "deckViewCard"],
    ["Viewing Deck (Picking 2 Cards)", "deckViewCard"],
    ["Viewing Deck (Top Card)", "deckViewCard"],
    ["Viewing Extra Deck", "extraDeckCard"],
    ["Viewing Host's Public Extra Deck", "extraDeckCard"],
    ["Viewing Xyz Materials", "xyzMaterial"],
    ["Viewing Opponent's Graveyard", "opponentCard"],
    ["Viewing Opponent's Banished", "opponentCard"],
  ] as const)("%s → %s", (title, group) => {
    expect(viewTitleGroup(title)).toBe(group);
  });

  it("returns null for views with no bindable group", () => {
    expect(viewTitleGroup("Viewing Opponent's Extra Deck")).toBeNull();
    expect(viewTitleGroup("Viewing Opponent's Hand")).toBeNull();
    expect(viewTitleGroup("Viewing Something New")).toBeNull();
  });
});

describe("fingerprintCardMenu", () => {
  it("pins a hand monster menu by its distinctive labels", () => {
    expect(
      fingerprintCardMenu([
        "Normal Summon",
        "Set",
        "S. Summon ATK",
        "S. Summon DEF",
        "Declare",
        "To Graveyard",
        "Banish",
        "Reveal",
      ]),
    ).toEqual(["handMonster"]);
  });

  it("narrows a spell menu to the hand/backrow pair", () => {
    // Every label here can appear in both groups' menus (though never all
    // three at once on the field) — the runtime resolves the tie with a
    // merged matcher, so both groups' keys keep working.
    expect(fingerprintCardMenu(["Activate", "Set", "Declare"]).sort()).toEqual([
      "fieldST",
      "handST",
    ]);
  });

  it("pins a hand spell menu when a hand-only label is present", () => {
    expect(
      fingerprintCardMenu(["Activate", "Set", "Declare", "Reveal"]).sort(),
    ).toEqual(["handST"]);
  });

  it("pins a face-down field monster menu", () => {
    expect(
      fingerprintCardMenu(["Flip Summon", "Flip", "To Hand", "Banish"]),
    ).toEqual(["fieldMonsterFaceDown"]);
  });

  it("returns all candidates for a genuinely ambiguous menu", () => {
    // All zones full: a hand monster and a hand trap render identically.
    const groups = fingerprintCardMenu([
      "To Graveyard",
      "Banish",
      "Banish FD",
      "To Top of Deck",
      "To Bottom of Deck",
      "To S/T",
      "Declare",
      "Reveal",
    ]).sort();
    expect(groups).toEqual(["handMonster", "handST"]);
  });

  it("ignores unknown (card-gated) labels", () => {
    expect(
      fingerprintCardMenu([
        "Normal Summon",
        "Look at cards",
        "Card of Fate Effect",
      ]),
    ).toEqual(["handMonster"]);
  });

  it("returns empty when no label is known", () => {
    expect(fingerprintCardMenu(["Look at cards"])).toEqual([]);
  });

  it("falls back to the union on contradictory labels (catalog drift)", () => {
    const debugSpy = jest.spyOn(console, "debug").mockImplementation();
    const groups = fingerprintCardMenu(["Normal Summon", "Flip Summon"]).sort();
    expect(groups).toEqual(["fieldMonsterFaceDown", "handMonster"]);
    expect(debugSpy).toHaveBeenCalled();
    debugSpy.mockRestore();
  });
});

describe("detectContextGroups", () => {
  it("recognizes pile menus first", () => {
    expect(
      detectContextGroups(
        snap({
          menuLabels: [
            "Show",
            "View",
            "Banish FD",
            "Banish T.",
            "Mill",
            "Shuffle",
            "Draw",
          ],
        }),
      ),
    ).toEqual(["mainPile"]);
    expect(detectContextGroups(snap({ menuLabels: ["Show", "View"] }))).toEqual(
      ["extraPile"],
    );
  });

  it("prefers the view title over the fingerprint for view cards", () => {
    // SS ATK alone would fingerprint to several groups; the view title
    // says exactly where the card lives.
    expect(
      detectContextGroups(
        snap({
          menuLabels: ["SS ATK", "SS DEF", "To Hand"],
          viewTitle: "Viewing Graveyard",
          pointerCardInView: true,
        }),
      ),
    ).toEqual(["graveCard"]);
  });

  it("ignores the view title when the pointer is outside the view", () => {
    // GY view open, but hovering a hand card behind it.
    expect(
      detectContextGroups(
        snap({
          menuLabels: ["Normal Summon", "Set"],
          viewTitle: "Viewing Graveyard",
          pointerCardInView: false,
        }),
      ),
    ).toEqual(["handMonster"]);
  });

  it("returns no group for unbindable views", () => {
    expect(
      detectContextGroups(
        snap({
          menuLabels: ["To Top of Deck"],
          viewTitle: "Viewing Opponent's Deck (Top 3 Cards)",
          pointerCardInView: true,
        }),
      ),
    ).toEqual([]);
  });

  it("uses pointer position for closed pile menus", () => {
    expect(detectContextGroups(snap({ pointerOverMainPile: true }))).toEqual([
      "mainPile",
    ]);
    expect(detectContextGroups(snap({ pointerOverExtraPile: true }))).toEqual([
      "extraPile",
    ]);
  });

  it("returns no group when nothing is hovered", () => {
    expect(detectContextGroups(snap({}))).toEqual([]);
  });
});
