import {
  actionCatalog,
  buildCardLabelIndex,
  catalogIndex,
  getCatalogEntry,
  getPlacement,
  ContextGroup,
  GROUP_LABELS,
  GROUP_ORDER,
} from "./actionCatalog";
import { parseSequence } from "../utilities/hotkeySequence";
import { findConflicts, hardConflicts } from "../utilities/hotkeyValidation";
import { getDefaultRows } from "../utilities/configUtility";
import { isAssignableToken } from "../utilities/keyNormalization";
import { isKnownFanLabel } from "../utilities/touchMenuData";

// The designed per-group default keymap, pinned in full: refactors can
// never silently change a shipped binding, add a placement, or drop one.
const EXPECTED_DEFAULTS: Record<ContextGroup, Record<string, string>> = {
  global: {
    "Close View Menu": "escape",
    "View Graveyard": "v g",
    "View Banish": "v b",
    "View Main Deck": "v d",
    "View Extra Deck": "v e",
    "Mill 1": "",
    "Mill 2": "",
    "Mill 3": "",
    "Mill 4": "",
    "Mill 5": "",
    "Mill 6": "",
    "Sub LP": "-",
    "Add LP": "+",
    "Toggle Chat Box": "enter",
    Think: "",
    "Thumbs Up": "",
    "Show Hotkey Hints": "f1",
  },
  mainPile: {
    Draw: "d",
    "Banish T.": "b",
    "Banish FD (Deck)": "shift+b",
    "Mill Deck": "m",
    Shuffle: "s",
    "Show Deck": "",
  },
  extraPile: {
    "Show Extra Deck": "",
  },
  handMonster: {
    "To S/T": "a",
    "Normal Summon": "n",
    Set: "shift+s",
    "Set (To S/T)": "",
    "S. Summon ATK": "s a",
    "S. Summon DEF": "s d",
    "Activate Left": "",
    "Activate Right": "",
    Declare: "d",
    "To Graveyard": "t g",
    Banish: "t b",
    "Banish FD": "t shift+b",
    "To Top of Deck": "t d",
    "To Bottom of Deck": "t shift+d",
    Reveal: "r",
    "Stop Revealing": "",
    "Stay Revealed": "",
  },
  handST: {
    Activate: "a",
    "To S/T": "",
    Set: "s",
    Declare: "d",
    "To Graveyard": "t g",
    Banish: "t b",
    "Banish FD": "t shift+b",
    "To Top of Deck": "t d",
    "To Bottom of Deck": "t shift+d",
    Reveal: "r",
    "Stop Revealing": "",
    "Stay Revealed": "",
  },
  fieldMonsterFaceUp: {
    Set: "s",
    "To ATK": "",
    "To DEF": "",
    Attack: "a",
    "Attack Directly": "a",
    Overlay: "o",
    Move: "m",
    "Activate Left": "",
    "Activate Right": "",
    Declare: "d",
    "To Hand": "t h",
    "To Extra Deck": "t e",
    "To Extra Deck FU": "t shift+e",
    "To Graveyard": "t g",
    Banish: "t b",
    "Banish FD": "t shift+b",
    "To Top of Deck": "t d",
    "To Bottom of Deck": "t shift+d",
    Target: "shift+t",
    Remove: "",
    "Resolve Effect": "",
  },
  fieldMonsterFaceDown: {
    "Flip Summon": "f",
    Flip: "shift+f",
    Move: "m",
    "To Hand": "t h",
    "To Extra Deck": "t e",
    "To Graveyard": "t g",
    Banish: "t b",
    "Banish FD": "t shift+b",
    "To Top of Deck": "t d",
    "To Bottom of Deck": "t shift+d",
    Target: "shift+t",
  },
  fieldST: {
    Activate: "a",
    Set: "shift+s",
    Move: "m",
    "Activate Left": "",
    "Activate Right": "",
    Declare: "d",
    "To Hand": "t h",
    "To Extra Deck FU": "t shift+e",
    "To Graveyard": "t g",
    Banish: "t b",
    "Banish FD": "t shift+b",
    "To Top of Deck": "t d",
    "To Bottom of Deck": "t shift+d",
    Target: "shift+t",
    "Resolve Effect": "",
  },
  graveCard: {
    "To S/T": "t s",
    "SS ATK": "s a",
    "SS DEF": "s d",
    "Activate Left": "",
    "Activate Right": "",
    Declare: "d",
    "To Hand": "t h",
    "To Extra Deck": "t e",
    "To Extra Deck FU": "t shift+e",
    Banish: "t b",
    "Banish FD": "t shift+b",
    "To T. Deck": "t d",
    "To B. Deck": "t shift+d",
    Target: "shift+t",
    Attach: "a",
    "Resolve Effect": "",
  },
  banishedCard: {
    "SS ATK": "s a",
    "SS DEF": "s d",
    "Activate Left": "",
    "Activate Right": "",
    Declare: "d",
    "To Hand": "t h",
    "To Extra Deck": "t e",
    "To Extra Deck FU": "t shift+e",
    "To Grave": "t g",
    "To T. Deck": "t d",
    "To B. Deck": "t shift+d",
    Target: "shift+t",
    Attach: "a",
    "Resolve Effect": "",
  },
  deckViewCard: {
    Activate: "a",
    "To S/T": "t s",
    "SS ATK": "s a",
    "SS DEF": "s d",
    "Activate Left": "",
    "Activate Right": "",
    "To Hand": "t h",
    "To Grave": "t g",
    Banish: "t b",
    "Banish FD": "t shift+b",
    Reveal: "r",
    "Stop Revealing": "",
    "Stay Revealed": "",
    Choose: "",
  },
  extraDeckCard: {
    "To S/T": "a",
    "SS ATK": "s a",
    "SS DEF": "s d",
    "OL ATK": "o a",
    "OL DEF": "o d",
    "Activate Left": "",
    "Activate Right": "",
    Declare: "d",
    "To Grave": "t g",
    Banish: "t b",
    "Banish FD": "t shift+b",
    Reveal: "r",
    "Stop Revealing": "",
    "Stay Revealed": "",
  },
  xyzMaterial: {
    Detach: "d",
    Banish: "t b",
  },
  opponentCard: {
    "SS ATK": "s a",
    "SS DEF": "s d",
    "To Grave": "t g",
    Banish: "t b",
    Target: "shift+t",
    Attach: "a",
  },
  replay: {
    "Play/Pause Replay": "space",
    "Step Backward": "arrowleft",
    "Next Play": "arrowright",
    "Speed Up": "arrowup",
    "Speed Down": "arrowdown",
    "Previous Turn": "[",
    "Next Turn": "]",
    "Jump to Game 1": "g 1",
    "Jump to Game 2": "g 2",
    "Jump to Game 3": "g 3",
  },
};

describe("actionCatalog", () => {
  it("has unique action ids", () => {
    const ids = actionCatalog.map((entry) => entry.action);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches the designed per-group default table exactly", () => {
    const actual: Record<string, Record<string, string>> = {};
    for (const row of getDefaultRows()) {
      (actual[row.context] ??= {})[row.action] = row.hotkey;
    }
    expect(actual).toEqual(EXPECTED_DEFAULTS);
  });

  it("has no hard conflicts and only the intended share among defaults", () => {
    const rows = getDefaultRows();
    const warned = new Set<string>();
    for (const row of rows) {
      const sequence = parseSequence(row.hotkey);
      if (sequence.length === 0) continue;
      const conflicts = findConflicts(sequence, row.context, row.action, rows);
      expect({
        row: `${row.context}/${row.action}`,
        hard: hardConflicts(conflicts),
      }).toEqual({ row: `${row.context}/${row.action}`, hard: [] });
      for (const conflict of conflicts) {
        warned.add(`${row.context}/${row.action}`);
      }
    }
    // Attack/Attack Directly deliberately share "a" (Attack wins when
    // both labels are offered); nothing else may warn.
    expect([...warned].sort()).toEqual([
      "fieldMonsterFaceUp/Attack",
      "fieldMonsterFaceUp/Attack Directly",
    ]);
  });

  it("maps kinds to legal placements", () => {
    for (const entry of actionCatalog) {
      expect(entry.placements.length).toBeGreaterThan(0);
      const contexts = entry.placements.map((placement) => placement.context);
      if (entry.kind === "global" || entry.kind === "pileMenu") {
        expect(contexts).toEqual(["global"]);
      } else if (entry.kind === "pileHover") {
        expect(contexts).toEqual([
          entry.pile === "main" ? "mainPile" : "extraPile",
        ]);
      } else if (entry.kind === "replay") {
        expect(contexts).toEqual(["replay"]);
      } else {
        // cardMenu: card groups only
        for (const context of contexts) {
          expect(context).not.toBe("global");
          expect(context).not.toBe("mainPile");
          expect(context).not.toBe("extraPile");
          expect(context).not.toBe("replay");
        }
      }
    }
  });

  it("gives every menu-clicking action a menu label and pile actions a pile", () => {
    for (const entry of actionCatalog) {
      if (entry.kind === "global" || entry.kind === "replay") {
        expect(entry.menuLabel).toBeUndefined();
        expect(entry.pile).toBeUndefined();
      } else {
        expect(entry.menuLabel).toBeTruthy();
      }
      if (entry.kind === "pileHover" || entry.kind === "pileMenu") {
        expect(entry.pile).toBeDefined();
      }
    }
  });

  it("only locks global actions", () => {
    for (const entry of actionCatalog) {
      if (entry.locked) {
        expect(entry.placements.map((placement) => placement.context)).toEqual([
          "global",
        ]);
      }
    }
  });

  it("only uses assignable keys in default hotkeys", () => {
    for (const entry of actionCatalog) {
      for (const placement of entry.placements) {
        for (const token of parseSequence(placement.defaultHotkey)) {
          expect({ token, assignable: isAssignableToken(token) }).toEqual({
            token,
            assignable: true,
          });
        }
      }
    }
  });

  it("labels every group and orders them all", () => {
    const placed = new Set(
      actionCatalog.flatMap((entry) =>
        entry.placements.map((placement) => placement.context),
      ),
    );
    for (const group of placed) {
      expect(GROUP_ORDER).toContain(group);
      expect(GROUP_LABELS[group]).toBeTruthy();
    }
  });

  it("indexes every cardMenu label for context detection", () => {
    const index = buildCardLabelIndex();
    for (const entry of actionCatalog) {
      if (entry.kind !== "cardMenu") continue;
      expect(index.get(entry.menuLabel!)).toBeDefined();
    }
  });

  it("uses only menu labels the touch fan's tables know", () => {
    for (const entry of actionCatalog) {
      if (!entry.menuLabel) continue;
      const context = entry.kind === "cardMenu" ? "card" : "pile";
      expect({
        label: entry.menuLabel,
        context,
        known: isKnownFanLabel(entry.menuLabel, context),
      }).toEqual({ label: entry.menuLabel, context, known: true });
    }
  });

  it("resolves placements and sorts unknown actions last", () => {
    expect(getPlacement("Draw", "mainPile")?.defaultHotkey).toBe("d");
    expect(getPlacement("Draw", "extraPile")).toBeUndefined();
    expect(getCatalogEntry("Not A Real Action")).toBeUndefined();
    expect(catalogIndex("Not A Real Action")).toBe(actionCatalog.length);
  });
});
