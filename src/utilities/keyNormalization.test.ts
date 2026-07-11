import {
  normalizeKeyEvent,
  parseToken,
  formatToken,
  isAssignableToken,
  displayToken,
  displaySequence,
} from "./keyNormalization";

describe("normalizeKeyEvent", () => {
  it("normalizes plain letters", () => {
    expect(normalizeKeyEvent({ key: "b", code: "KeyB", shiftKey: false })).toBe(
      "b",
    );
  });

  it("records shift on letters", () => {
    expect(normalizeKeyEvent({ key: "B", code: "KeyB", shiftKey: true })).toBe(
      "shift+b",
    );
  });

  it("is immune to CapsLock", () => {
    expect(normalizeKeyEvent({ key: "B", code: "KeyB", shiftKey: false })).toBe(
      "b",
    );
  });

  it("records shift on digits despite the shifted character", () => {
    expect(
      normalizeKeyEvent({ key: "!", code: "Digit1", shiftKey: true }),
    ).toBe("shift+1");
  });

  it("drops shift on punctuation ('+' is typed as Shift+=)", () => {
    expect(normalizeKeyEvent({ key: "+", code: "Equal", shiftKey: true })).toBe(
      "+",
    );
  });

  it("passes shifted punctuation through as its produced character", () => {
    expect(normalizeKeyEvent({ key: "?", code: "Slash", shiftKey: true })).toBe(
      "?",
    );
    expect(isAssignableToken("?")).toBe(false);
  });

  it("ignores shift on enter, escape, and f1", () => {
    for (const [key, code] of [
      ["Enter", "Enter"],
      ["Escape", "Escape"],
      ["F1", "F1"],
    ]) {
      expect(normalizeKeyEvent({ key, code, shiftKey: true })).toBe(
        key.toLowerCase(),
      );
      expect(normalizeKeyEvent({ key, code, shiftKey: false })).toBe(
        key.toLowerCase(),
      );
    }
  });

  it("returns null for modifier keys themselves", () => {
    expect(
      normalizeKeyEvent({ key: "Shift", code: "ShiftLeft", shiftKey: true }),
    ).toBeNull();
    expect(
      normalizeKeyEvent({
        key: "Control",
        code: "ControlLeft",
        shiftKey: false,
      }),
    ).toBeNull();
  });
});

describe("parseToken / formatToken", () => {
  it("round-trips shifted and plain tokens", () => {
    expect(parseToken("shift+b")).toEqual({ key: "b", shift: true });
    expect(parseToken("b")).toEqual({ key: "b", shift: false });
    expect(formatToken({ key: "b", shift: true })).toBe("shift+b");
    expect(formatToken({ key: "b", shift: false })).toBe("b");
  });

  it("handles the bare '+' token", () => {
    expect(parseToken("+")).toEqual({ key: "+", shift: false });
    expect(formatToken(parseToken("+"))).toBe("+");
  });
});

describe("display helpers", () => {
  it("renders shifted tokens with the shift symbol", () => {
    expect(displayToken("shift+b")).toBe("⇧B");
    expect(displayToken("enter")).toBe("ENTER");
  });

  it("renders sequences with arrows", () => {
    expect(displaySequence("s shift+b")).toBe("S → ⇧B");
    expect(displaySequence("")).toBe("unset");
  });
});

describe("isAssignableToken", () => {
  it("accepts shifted letters and f1", () => {
    expect(isAssignableToken("shift+b")).toBe(true);
    expect(isAssignableToken("f1")).toBe(true);
  });

  it("rejects unknown base keys", () => {
    expect(isAssignableToken("f2")).toBe(false);
    expect(isAssignableToken("tab")).toBe(false);
  });
});
