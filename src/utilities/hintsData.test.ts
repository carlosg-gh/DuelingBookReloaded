import { buildHintGroups } from "./hintsData";
import { ContextHotkeyEntry } from "./hotkeySequence";
import { ContextGroup } from "../data/actionCatalog";

function row(
  context: ContextGroup,
  action: string,
  hotkey: string,
  disabled = false,
): ContextHotkeyEntry {
  return { context, action, hotkey, disabled };
}

describe("buildHintGroups", () => {
  it("groups bound rows by context group in GROUP_ORDER", () => {
    const groups = buildHintGroups([
      row("handMonster", "Normal Summon", "n"),
      row("global", "View Graveyard", "v g"),
      row("mainPile", "Draw", "d"),
    ]);
    expect(groups.map((group) => group.context)).toEqual([
      "global",
      "mainPile",
      "handMonster",
    ]);
    expect(groups[0].title).toBe("Anywhere");
    expect(groups[2].rows).toEqual([
      { label: "Normal Summon", hotkey: "n", actions: ["Normal Summon"] },
    ]);
  });

  it("excludes disabled and unbound rows", () => {
    expect(
      buildHintGroups([
        row("handMonster", "Normal Summon", "n", true),
        row("handMonster", "Set (To S/T)", ""),
      ]),
    ).toEqual([]);
  });

  it("renders an action bound in several groups once per group", () => {
    const groups = buildHintGroups([
      row("handMonster", "Declare", "d"),
      row("graveCard", "Declare", "d"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].rows[0].label).toBe("Declare");
    expect(groups[1].rows[0].label).toBe("Declare");
  });
});
