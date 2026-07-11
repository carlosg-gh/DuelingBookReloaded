import { buildHintGroups } from "./hintsData";
import { HotkeyEntry } from "./configUtility";

function entry(action: string, hotkey: string, disabled = false): HotkeyEntry {
  return { action, hotkey, disabled };
}

describe("buildHintGroups", () => {
  it("groups enabled bindings in hotkeySections order", () => {
    const groups = buildHintGroups([
      entry("Think", "t"),
      entry("View Graveyard", "g"),
    ]);
    expect(groups.map((group) => group.title)).toEqual([
      "Deck Actions",
      "Emotes/Chat Box",
    ]);
    expect(groups[0].rows).toEqual([
      { label: "View Graveyard", hotkey: "g", actions: ["View Graveyard"] },
    ]);
  });

  it("excludes disabled and unbound entries", () => {
    const groups = buildHintGroups([
      entry("Think", "t", true),
      entry("Thumbs Up", ""),
    ]);
    expect(groups).toEqual([]);
  });

  it("renders one row for a compound label sharing a binding", () => {
    const groups = buildHintGroups([
      entry("To Hand", "h"),
      entry("To Extra Deck", "h"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toEqual([
      {
        label: "To Hand/To Extra Deck",
        hotkey: "h",
        actions: ["To Hand", "To Extra Deck"],
      },
    ]);
  });

  it("includes the Extension section", () => {
    const groups = buildHintGroups([entry("Show Hotkey Hints", "f1")]);
    expect(groups).toEqual([
      {
        title: "Extension",
        rows: [
          {
            label: "Show Hotkey Hints",
            hotkey: "f1",
            actions: ["Show Hotkey Hints"],
          },
        ],
      },
    ]);
  });
});
