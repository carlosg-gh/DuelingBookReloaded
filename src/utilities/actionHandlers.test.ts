import { buildActionFunctionMap, findHandlerGaps } from "./actionHandlers";
import { actionCatalog, CatalogEntry } from "../data/actionCatalog";

function stubDeps() {
  return {
    playCard: jest.fn(),
    hoverPileAction: jest.fn(),
    clickPileAction: jest.fn(),
    customHandlers: Object.fromEntries(
      actionCatalog
        .filter((entry) => entry.kind === "global" || entry.kind === "replay")
        .map((entry) => [entry.action, jest.fn()]),
    ),
  };
}

describe("buildActionFunctionMap", () => {
  it("wires every catalog action to a function", () => {
    const map = buildActionFunctionMap(actionCatalog, stubDeps());
    for (const entry of actionCatalog) {
      expect(typeof map[entry.action]).toBe("function");
    }
  });

  it("routes cardMenu actions to playCard with their label", () => {
    const deps = stubDeps();
    const map = buildActionFunctionMap(actionCatalog, deps);
    map["Flip Summon"]();
    expect(deps.playCard).toHaveBeenCalledWith("Flip Summon");
    map["To Grave"]();
    expect(deps.playCard).toHaveBeenCalledWith("To Grave");
  });

  it("routes pileMenu actions to clickPileAction with pile and label", () => {
    const deps = stubDeps();
    const map = buildActionFunctionMap(actionCatalog, deps);
    map["View Main Deck"]();
    expect(deps.clickPileAction).toHaveBeenCalledWith("main", "View");
    map["View Extra Deck"]();
    expect(deps.clickPileAction).toHaveBeenCalledWith("extra", "View");
  });

  it("routes pileHover actions to hoverPileAction with pile and label", () => {
    const deps = stubDeps();
    const map = buildActionFunctionMap(actionCatalog, deps);
    map["Mill Deck"]();
    expect(deps.hoverPileAction).toHaveBeenCalledWith("main", "Mill");
    map["Show Extra Deck"]();
    expect(deps.hoverPileAction).toHaveBeenCalledWith("extra", "Show");
    expect(deps.clickPileAction).not.toHaveBeenCalled();
  });

  it("routes global actions to their custom handler", () => {
    const deps = stubDeps();
    const map = buildActionFunctionMap(actionCatalog, deps);
    map["View Graveyard"]();
    expect(deps.customHandlers["View Graveyard"]).toHaveBeenCalled();
  });

  it("lets a custom handler override a derived one", () => {
    const deps = stubDeps();
    const override = jest.fn();
    deps.customHandlers["View Main Deck"] = override;
    const map = buildActionFunctionMap(actionCatalog, deps);
    map["View Main Deck"]();
    expect(override).toHaveBeenCalled();
    expect(deps.clickPileAction).not.toHaveBeenCalled();
  });

  it("maps a handler-less global action to an error-logging no-op", () => {
    const catalog: CatalogEntry[] = [
      {
        action: "Mystery",
        kind: "global",
        placements: [{ context: "global", defaultHotkey: "" }],
        section: "X",
      },
    ];
    const map = buildActionFunctionMap(catalog, {
      playCard: jest.fn(),
      hoverPileAction: jest.fn(),
      clickPileAction: jest.fn(),
      customHandlers: {},
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation();
    expect(() => map["Mystery"]()).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("findHandlerGaps", () => {
  it("reports globals without handlers and handlers without actions", () => {
    const catalog: CatalogEntry[] = [
      {
        action: "Mystery",
        kind: "global",
        placements: [{ context: "global", defaultHotkey: "" }],
        section: "X",
      },
    ];
    expect(findHandlerGaps(catalog, { Typo: jest.fn() })).toEqual({
      missingGlobals: ["Mystery"],
      unknownHandlers: ["Typo"],
    });
  });

  it("is clean for a full stub handler set over the real catalog", () => {
    expect(findHandlerGaps(actionCatalog, stubDeps().customHandlers)).toEqual({
      missingGlobals: [],
      unknownHandlers: [],
    });
  });
});
