import {
  serializeConfig,
  parseConfigImport,
  EXPORT_FORMAT,
  EXPORT_VERSION,
} from "./configTransfer";
import { getDefaultRows, expandOverrides } from "./configUtility";

function fileWith(overrides: unknown, envelope: Record<string, unknown> = {}) {
  return JSON.stringify({
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    overrides,
    ...envelope,
  });
}

function hotkeyOf(
  rows: ReturnType<typeof getDefaultRows>,
  context: string,
  action: string,
) {
  return rows.find((row) => row.context === context && row.action === action)
    ?.hotkey;
}

describe("serializeConfig / parseConfigImport round trip", () => {
  it("round-trips a customized config", () => {
    const rows = expandOverrides({
      mainPile: { Draw: { hotkey: "x" } },
      graveCard: { Banish: { hotkey: "", disabled: true } },
    });
    const result = parseConfigImport(serializeConfig(rows));
    expect(result).toEqual({ ok: true, rows, dropped: [] });
  });

  it("exports pure defaults as an empty overrides object", () => {
    const json = serializeConfig(getDefaultRows());
    expect(JSON.parse(json).overrides).toEqual({});
    expect(parseConfigImport(json)).toEqual({
      ok: true,
      rows: getDefaultRows(),
      dropped: [],
    });
  });

  it("keeps disabled flags through the round trip", () => {
    const rows = expandOverrides({
      handMonster: { "Normal Summon": { disabled: true } },
    });
    const result = parseConfigImport(serializeConfig(rows));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.rows.find(
          (row) =>
            row.context === "handMonster" && row.action === "Normal Summon",
        )?.disabled,
      ).toBe(true);
    }
  });
});

describe("parseConfigImport rejections", () => {
  it("rejects invalid JSON", () => {
    expect(parseConfigImport("{nope")).toEqual({
      ok: false,
      error: "That file is not valid JSON.",
    });
  });

  it("rejects files that are not hotkey exports", () => {
    expect(parseConfigImport(JSON.stringify({ hello: 1 }))).toEqual({
      ok: false,
      error: "That file is not a hotkey export.",
    });
    expect(parseConfigImport(JSON.stringify([1, 2]))).toEqual({
      ok: false,
      error: "That file is not a hotkey export.",
    });
  });

  it("rejects unsupported versions", () => {
    const result = parseConfigImport(
      JSON.stringify({ format: EXPORT_FORMAT, version: 99, overrides: {} }),
    );
    expect(result).toEqual({
      ok: false,
      error: `Unsupported export version (99); this extension reads version ${EXPORT_VERSION}.`,
    });
  });

  it("rejects a missing overrides object", () => {
    expect(
      parseConfigImport(
        JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION }),
      ),
    ).toEqual({ ok: false, error: "That file has no bindings in it." });
  });
});

describe("parseConfigImport sanitization", () => {
  it("drops unknown contexts and actions by name", () => {
    const result = parseConfigImport(
      fileWith({
        bogusContext: { Draw: { hotkey: "x" } },
        mainPile: { "Bogus Action": { hotkey: "x" } },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toEqual(getDefaultRows());
      expect(result.dropped.sort()).toEqual([
        "Deck Pile (hovering): Bogus Action",
        "bogusContext: Draw",
      ]);
    }
  });

  it("drops malformed values and unassignable tokens", () => {
    const result = parseConfigImport(
      fileWith({
        mainPile: {
          Draw: { hotkey: 5 },
          Shuffle: { hotkey: "f13" },
          "Mill Deck": { disabled: "yes" },
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toEqual(getDefaultRows());
      expect(result.dropped).toHaveLength(3);
    }
  });

  it("keeps equal-key overrides in one group (warning-level share)", () => {
    const result = parseConfigImport(
      fileWith({
        mainPile: {
          Draw: { hotkey: "x" },
          Shuffle: { hotkey: "x" },
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(hotkeyOf(result.rows, "mainPile", "Draw")).toBe("x");
      expect(hotkeyOf(result.rows, "mainPile", "Shuffle")).toBe("x");
      expect(result.dropped).toEqual([]);
    }
  });

  it("drops the later of two prefix-colliding overrides in one group", () => {
    // Catalog order within mainPile: Draw before Shuffle.
    const result = parseConfigImport(
      fileWith({
        mainPile: {
          Draw: { hotkey: "x" },
          Shuffle: { hotkey: "x y" },
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(hotkeyOf(result.rows, "mainPile", "Draw")).toBe("x");
      // the dropped override keeps its shipped default
      expect(hotkeyOf(result.rows, "mainPile", "Shuffle")).toBe("s");
      expect(result.dropped).toEqual(["Deck Pile (hovering): Shuffle"]);
    }
  });

  it("keeps colliding overrides that live in different groups", () => {
    const result = parseConfigImport(
      fileWith({
        handMonster: { Reveal: { hotkey: "x" } },
        graveCard: { Attach: { hotkey: "x" } },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(hotkeyOf(result.rows, "handMonster", "Reveal")).toBe("x");
      expect(hotkeyOf(result.rows, "graveCard", "Attach")).toBe("x");
      expect(result.dropped).toEqual([]);
    }
  });

  it("lets an imported key beat a shipped default, like an upgrade would", () => {
    const result = parseConfigImport(
      fileWith({ handMonster: { Reveal: { hotkey: "n" } } }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(hotkeyOf(result.rows, "handMonster", "Reveal")).toBe("n");
      // shipped Normal Summon default ("n") yields to the user's key
      expect(hotkeyOf(result.rows, "handMonster", "Normal Summon")).toBe("");
      expect(result.dropped).toEqual([]);
    }
  });

  it("drops overrides on locked actions", () => {
    const result = parseConfigImport(
      fileWith({ global: { "Close View Menu": { hotkey: "x" } } }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(hotkeyOf(result.rows, "global", "Close View Menu")).toBe("escape");
      expect(result.dropped).toEqual(["Anywhere: Close View Menu"]);
    }
  });
});
