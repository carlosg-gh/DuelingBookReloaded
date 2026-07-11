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
});
