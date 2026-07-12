import { findConflicts, hardConflicts } from "./hotkeyValidation";
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

const rows: ContextHotkeyEntry[] = [
  row("global", "View Graveyard", "v g"),
  row("global", "Show Hotkey Hints", "f1"),
  row("handMonster", "Normal Summon", "n"),
  row("handMonster", "To Graveyard", "t g"),
  row("fieldMonsterFaceDown", "Flip Summon", "n"),
  row("fieldMonsterFaceDown", "Target", "t"),
  row("graveCard", "Banish", "", false),
  row("graveCard", "To Hand", "h", true),
];

describe("findConflicts", () => {
  it("accepts a free key", () => {
    expect(findConflicts(["k"], "handMonster", "Set", rows)).toEqual([]);
  });

  it("ignores an empty candidate", () => {
    expect(findConflicts([], "handMonster", "Set", rows)).toEqual([]);
  });

  it("warns (not blocks) on an equal key within the same group", () => {
    const conflicts = findConflicts(["n"], "handMonster", "Set", rows);
    expect(conflicts).toEqual([
      {
        context: "handMonster",
        action: "Normal Summon",
        hotkey: "n",
        reason: "equal",
        severity: "warning",
      },
    ]);
    expect(hardConflicts(conflicts)).toEqual([]);
  });

  it("hard-blocks prefix relations within the same group, both directions", () => {
    expect(findConflicts(["t"], "handMonster", "Set", rows)).toEqual([
      {
        context: "handMonster",
        action: "To Graveyard",
        hotkey: "t g",
        reason: "prefix",
        severity: "hard",
      },
    ]);
    expect(findConflicts(["t", "g", "x"], "handMonster", "Set", rows)).toEqual([
      {
        context: "handMonster",
        action: "To Graveyard",
        hotkey: "t g",
        reason: "prefix",
        severity: "hard",
      },
    ]);
  });

  it("allows the same key in a different group without any conflict", () => {
    expect(findConflicts(["n"], "graveCard", "SS ATK", rows)).toEqual([]);
  });

  it("allows cross-group prefix relations", () => {
    expect(findConflicts(["t", "h"], "graveCard", "To Hand", rows)).toEqual([]);
  });

  it("hard-blocks a group key equal to or prefixed by a global key", () => {
    expect(findConflicts(["f1"], "handMonster", "Set", rows)).toEqual([
      {
        context: "global",
        action: "Show Hotkey Hints",
        hotkey: "f1",
        reason: "equal",
        severity: "hard",
      },
    ]);
    expect(findConflicts(["v"], "handMonster", "Set", rows)).toEqual([
      {
        context: "global",
        action: "View Graveyard",
        hotkey: "v g",
        reason: "prefix",
        severity: "hard",
      },
    ]);
  });

  it("hard-blocks a global candidate against every group", () => {
    const conflicts = findConflicts(["n"], "global", "Think", rows);
    expect(conflicts.map((conflict) => conflict.context).sort()).toEqual([
      "fieldMonsterFaceDown",
      "handMonster",
    ]);
    expect(hardConflicts(conflicts)).toHaveLength(2);
  });

  it("exempts the edited row itself", () => {
    expect(findConflicts(["n"], "handMonster", "Normal Summon", rows)).toEqual(
      [],
    );
  });

  it("ignores disabled and unbound rows", () => {
    expect(findConflicts(["h"], "graveCard", "SS ATK", rows)).toEqual([]);
    expect(
      findConflicts(["x"], "graveCard", "SS ATK", [
        row("graveCard", "Banish", "", false),
      ]),
    ).toEqual([]);
  });

  it("does not conflict a shifted key with its plain form", () => {
    expect(findConflicts(["shift+n"], "handMonster", "Set", rows)).toEqual([]);
  });

  it("warns on equal shifted sequences in one group", () => {
    const withShift = [row("handMonster", "S. Summon ATK", "s shift+b")];
    expect(
      findConflicts(["s", "shift+b"], "handMonster", "Set", withShift),
    ).toEqual([
      {
        context: "handMonster",
        action: "S. Summon ATK",
        hotkey: "s shift+b",
        reason: "equal",
        severity: "warning",
      },
    ]);
  });
});
