import { CatalogEntry } from "../data/actionCatalog";

export interface HandlerDeps {
  /** Click this label in the currently-open card menu (no-op if absent). */
  playCard: (label: string) => void;
  /**
   * Click this label in the pile's menu, but only when that menu is
   * already open from hovering the pile (no-op otherwise).
   */
  hoverPileAction: (pile: "main" | "extra", label: string) => void;
  /** Open a pile's menu via synthetic hover and click this label in it. */
  clickPileAction: (pile: "main" | "extra", label: string) => void;
  /**
   * Handlers for `global` actions, plus optional overrides for any action
   * whose derived behavior isn't enough (e.g. the View actions toggle).
   */
  customHandlers: Record<string, () => void>;
}

export interface HandlerGaps {
  /**
   * Global/replay actions with no custom handler — their keys would be
   * dead (both kinds have no derivable behavior; they need custom wiring).
   */
  missingGlobals: string[];
  /** customHandlers keys naming no catalog action — silently ignored. */
  unknownHandlers: string[];
}

/**
 * Wiring mistakes between the catalog and the handler set. Never throw on
 * these at runtime — the content script builds the map inside
 * window.onload, and an exception there would take down every extension
 * feature; report so callers can log and tests can assert emptiness.
 */
export function findHandlerGaps(
  catalog: CatalogEntry[],
  customHandlers: Record<string, () => void>,
): HandlerGaps {
  const actions = new Set(catalog.map((entry) => entry.action));
  return {
    missingGlobals: catalog
      .filter(
        (entry) =>
          (entry.kind === "global" || entry.kind === "replay") &&
          !customHandlers[entry.action],
      )
      .map((entry) => entry.action),
    unknownHandlers: Object.keys(customHandlers).filter(
      (action) => !actions.has(action),
    ),
  };
}

/**
 * Derive the action→function map from the catalog so an action can never
 * exist without a handler (the old "two maps must stay in sync" gotcha).
 * A global action missing from customHandlers maps to an error-logging
 * no-op; pair with findHandlerGaps to surface the mistake at startup and
 * in unit tests.
 */
export function buildActionFunctionMap(
  catalog: CatalogEntry[],
  deps: HandlerDeps,
): Record<string, () => void> {
  const map: Record<string, () => void> = {};
  for (const entry of catalog) {
    const custom = deps.customHandlers[entry.action];
    if (custom) {
      map[entry.action] = custom;
    } else if (entry.kind === "cardMenu") {
      const label = entry.menuLabel!;
      map[entry.action] = () => deps.playCard(label);
    } else if (entry.kind === "pileHover") {
      const pile = entry.pile!;
      const label = entry.menuLabel!;
      map[entry.action] = () => deps.hoverPileAction(pile, label);
    } else if (entry.kind === "pileMenu") {
      const pile = entry.pile!;
      const label = entry.menuLabel!;
      map[entry.action] = () => deps.clickPileAction(pile, label);
    } else {
      map[entry.action] = () =>
        console.error(`[DBR] No handler wired for action "${entry.action}"`);
    }
  }
  return map;
}
