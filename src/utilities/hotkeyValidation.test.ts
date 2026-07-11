import { findSequenceConflict } from "./hotkeyValidation";
import { HotkeyEntry } from "./configUtility";

const entries: HotkeyEntry[] = [
  { action: "View Graveyard", hotkey: "g", disabled: false },
  { action: "View Extra Deck", hotkey: "v e", disabled: false },
  { action: "To Hand", hotkey: "h", disabled: false },
  { action: "To Extra Deck", hotkey: "h", disabled: false },
];

describe("findSequenceConflict", () => {
  it("accepts a free key", () => {
    expect(findSequenceConflict(["t"], ["Think"], entries)).toBeNull();
  });

  it("rejects an exact duplicate", () => {
    expect(findSequenceConflict(["g"], ["Think"], entries)).toEqual({
      action: "View Graveyard",
      hotkey: "g",
    });
  });

  it("rejects a candidate that is a prefix of an existing sequence", () => {
    expect(findSequenceConflict(["v"], ["Think"], entries)).toEqual({
      action: "View Extra Deck",
      hotkey: "v e",
    });
  });

  it("rejects a candidate that an existing binding is a prefix of", () => {
    expect(findSequenceConflict(["g", "e"], ["Think"], entries)).toEqual({
      action: "View Graveyard",
      hotkey: "g",
    });
  });

  it("accepts sequences that merely share a prefix", () => {
    expect(findSequenceConflict(["v", "g"], ["Think"], entries)).toBeNull();
  });

  it("exempts the actions being edited (compound group re-save)", () => {
    expect(
      findSequenceConflict(["h"], ["To Hand", "To Extra Deck"], entries),
    ).toBeNull();
  });

  it("ignores an empty candidate", () => {
    expect(findSequenceConflict([], ["Think"], entries)).toBeNull();
  });

  it("does not conflict a shifted key with its plain form", () => {
    expect(findSequenceConflict(["shift+g"], ["Think"], entries)).toBeNull();
  });

  it("conflicts a sequence with its shift-step prefix binding", () => {
    expect(findSequenceConflict(["g", "shift+b"], ["Think"], entries)).toEqual({
      action: "View Graveyard",
      hotkey: "g",
    });
  });

  it("ignores disabled entries entirely", () => {
    const withDisabled: HotkeyEntry[] = [
      { action: "View Graveyard", hotkey: "g", disabled: true },
      { action: "View Extra Deck", hotkey: "v e", disabled: true },
    ];
    expect(findSequenceConflict(["g"], ["Think"], withDisabled)).toBeNull();
    expect(findSequenceConflict(["v"], ["Think"], withDisabled)).toBeNull();
  });

  it("still conflicts with enabled entries when others are disabled", () => {
    const mixed: HotkeyEntry[] = [
      { action: "View Graveyard", hotkey: "g", disabled: true },
      { action: "Think", hotkey: "t", disabled: false },
    ];
    expect(findSequenceConflict(["t"], ["Declare"], mixed)).toEqual({
      action: "Think",
      hotkey: "t",
    });
  });

  it("conflicts equal shifted sequences", () => {
    const withShift = [
      ...entries,
      { action: "Banish FD", hotkey: "s shift+b", disabled: false },
    ];
    expect(
      findSequenceConflict(["s", "shift+b"], ["Think"], withShift),
    ).toEqual({ action: "Banish FD", hotkey: "s shift+b" });
  });
});
