import { SequenceMatcher } from "./sequenceMatcher";
import { HotkeyEntry } from "./configUtility";

function entry(action: string, hotkey: string, disabled = false): HotkeyEntry {
  return { action, hotkey, disabled };
}

describe("SequenceMatcher", () => {
  it("fires a single-key binding immediately", () => {
    const matcher = new SequenceMatcher([entry("View Graveyard", "g")]);
    expect(matcher.step("g")).toEqual({
      type: "fire",
      actions: ["View Graveyard"],
    });
  });

  it("returns nomatch for unbound keys", () => {
    const matcher = new SequenceMatcher([entry("View Graveyard", "g")]);
    expect(matcher.step("z")).toEqual({ type: "nomatch" });
  });

  it("fires a multi-key sequence step by step", () => {
    const matcher = new SequenceMatcher([entry("View Extra Deck", "v e")]);
    expect(matcher.step("v")).toEqual({ type: "prefix" });
    expect(matcher.step("e")).toEqual({
      type: "fire",
      actions: ["View Extra Deck"],
    });
  });

  it("distinguishes sequences sharing a prefix", () => {
    const matcher = new SequenceMatcher([
      entry("View Extra Deck", "v e"),
      entry("View Graveyard", "v g"),
      entry("View Main Deck", "v d"),
    ]);
    expect(matcher.step("v")).toEqual({ type: "prefix" });
    expect(matcher.step("g")).toEqual({
      type: "fire",
      actions: ["View Graveyard"],
    });
    expect(matcher.step("v")).toEqual({ type: "prefix" });
    expect(matcher.step("d")).toEqual({
      type: "fire",
      actions: ["View Main Deck"],
    });
  });

  it("returns all actions bound to the same sequence", () => {
    const matcher = new SequenceMatcher([
      entry("To Hand", "h"),
      entry("To Extra Deck", "h"),
    ]);
    expect(matcher.step("h")).toEqual({
      type: "fire",
      actions: ["To Hand", "To Extra Deck"],
    });
  });

  it("excludes disabled entries", () => {
    const matcher = new SequenceMatcher([
      entry("View Graveyard", "g", true),
      entry("Think", "t"),
    ]);
    expect(matcher.step("g")).toEqual({ type: "nomatch" });
    expect(matcher.step("t")).toEqual({ type: "fire", actions: ["Think"] });
  });

  it("retries a dead-end key from the root", () => {
    const matcher = new SequenceMatcher([
      entry("View Extra Deck", "v e"),
      entry("View Graveyard", "g"),
    ]);
    expect(matcher.step("v")).toEqual({ type: "prefix" });
    // 'g' doesn't continue "v ...", but is itself bound
    expect(matcher.step("g")).toEqual({
      type: "fire",
      actions: ["View Graveyard"],
    });
  });

  it("resets on a dead-end key that is also unbound", () => {
    const matcher = new SequenceMatcher([entry("View Extra Deck", "v e")]);
    expect(matcher.step("v")).toEqual({ type: "prefix" });
    expect(matcher.step("z")).toEqual({ type: "nomatch" });
    // sequence restarted cleanly
    expect(matcher.step("e")).toEqual({ type: "nomatch" });
    expect(matcher.step("v")).toEqual({ type: "prefix" });
    expect(matcher.step("e")).toEqual({
      type: "fire",
      actions: ["View Extra Deck"],
    });
  });

  it("reset() abandons a pending sequence (timeout behavior)", () => {
    const matcher = new SequenceMatcher([
      entry("View Extra Deck", "v e"),
      entry("Think", "e"),
    ]);
    expect(matcher.step("v")).toEqual({ type: "prefix" });
    matcher.reset();
    expect(matcher.step("e")).toEqual({ type: "fire", actions: ["Think"] });
  });

  it("fires immediately when a binding is both terminal and a prefix (legacy data)", () => {
    const matcher = new SequenceMatcher([
      entry("View Main Deck", "v"),
      entry("View Extra Deck", "v e"),
    ]);
    expect(matcher.step("v")).toEqual({
      type: "fire",
      actions: ["View Main Deck"],
    });
  });

  it("treats shifted and plain keys as distinct bindings", () => {
    const matcher = new SequenceMatcher([
      entry("Banish", "b"),
      entry("Banish FD", "shift+b"),
    ]);
    expect(matcher.step("b")).toEqual({ type: "fire", actions: ["Banish"] });
    expect(matcher.step("shift+b")).toEqual({
      type: "fire",
      actions: ["Banish FD"],
    });
  });

  it("tracks the pending prefix", () => {
    const matcher = new SequenceMatcher([
      entry("Banish FD", "s shift+b"),
      entry("View Graveyard", "g"),
    ]);
    expect(matcher.pendingPrefix()).toEqual([]);
    matcher.step("s");
    expect(matcher.pendingPrefix()).toEqual(["s"]);
    matcher.step("shift+b"); // fire
    expect(matcher.pendingPrefix()).toEqual([]);
    matcher.step("s");
    matcher.step("g"); // dead end retried from root -> fires 'g'
    expect(matcher.pendingPrefix()).toEqual([]);
    matcher.step("s");
    matcher.reset();
    expect(matcher.pendingPrefix()).toEqual([]);
  });

  it("lists continuations from the root and after a prefix", () => {
    const matcher = new SequenceMatcher([
      entry("View Extra Deck", "v e"),
      entry("View Graveyard", "g"),
    ]);
    expect(matcher.continuations()).toEqual(
      expect.arrayContaining([
        { rest: ["v", "e"], actions: ["View Extra Deck"] },
        { rest: ["g"], actions: ["View Graveyard"] },
      ]),
    );
    matcher.step("v");
    expect(matcher.continuations()).toEqual([
      { rest: ["e"], actions: ["View Extra Deck"] },
    ]);
  });

  it("supports three-key sequences", () => {
    const matcher = new SequenceMatcher([entry("Mill 3", "m i 3")]);
    expect(matcher.step("m")).toEqual({ type: "prefix" });
    expect(matcher.step("i")).toEqual({ type: "prefix" });
    expect(matcher.step("3")).toEqual({ type: "fire", actions: ["Mill 3"] });
  });
});
