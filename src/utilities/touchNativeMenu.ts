/**
 * Bridge to DuelingBook's native card menu from the extension's isolated
 * world. We cannot call page functions, but native dispatched MouseEvents
 * trigger DuelingBook's jQuery handlers synchronously:
 *
 * - `mouseover` on a card's `.content` runs `cardMenuE`, which computes the
 *   card's available actions and renders `#card_menu` next to the card.
 * - When closed, `#card_menu` is *detached from the DOM* (`menu.detach()`),
 *   so presence in the document is the open/closed signal.
 * - `mouseleave` on `.content` (jQuery synthesizes it from `mouseout`) runs
 *   `menuOutE`, which only removes the menu when the event's coordinates map
 *   BELOW the card's top edge — coordinates above it are treated as the
 *   pointer moving up into the menu. Hence the `rect.bottom + 20` trick.
 * - `showMenu` has silent guards (card tweening, overlay visible, same
 *   card); success must be verified by reading `#card_menu` back.
 */

export interface TapPoint {
  x: number;
  y: number;
}

function mouseEvent(type: string, point: TapPoint): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: point.x,
    clientY: point.y,
    relatedTarget: document.body,
  });
}

export function readMenuLabels(): string[] {
  const spans = document.querySelectorAll(
    "#card_menu_content .card_menu_btn span",
  );
  return Array.from(spans, (span) => span.textContent ?? "");
}

export function isMenuOpen(): boolean {
  return (
    document.getElementById("card_menu") !== null && readMenuLabels().length > 0
  );
}

/**
 * Open the native menu for a duel card by simulating hover on its `.content`
 * (plus a `click` on the card so DuelingBook's own preview shows). Returns
 * the menu's action labels, or null when DuelingBook refused to open it.
 */
export function openCardMenu(
  card: HTMLElement,
  point: TapPoint,
): string[] | null {
  const content = card.querySelector(".content");
  if (!content) return null;
  content.dispatchEvent(mouseEvent("mouseover", point));
  // previewE runs on card click and shows the big card preview on the left
  card.dispatchEvent(mouseEvent("click", point));
  return isMenuOpen() ? readMenuLabels() : null;
}

/** Open the native menu for a pile (#deck_hidden, #grave_hidden, ...). */
export function openPileMenu(
  pile: HTMLElement,
  point: TapPoint,
): string[] | null {
  pile.dispatchEvent(mouseEvent("mouseover", point));
  return isMenuOpen() ? readMenuLabels() : null;
}

/** Click the native menu button with this exact label (same as playCard). */
export function clickMenuAction(label: string): boolean {
  const buttons = document.querySelectorAll(
    "#card_menu_content .card_menu_btn",
  );
  for (const button of buttons) {
    const span = button.getElementsByTagName("span")[0];
    if (span && span.textContent === label) {
      span.click();
      return true;
    }
  }
  return false;
}

/**
 * Ask DuelingBook to remove the native menu: a mouseleave whose coordinates
 * land below the anchor's bottom edge always passes menuOutE's checks.
 */
export function closeNativeMenu(anchor: HTMLElement): void {
  if (!isMenuOpen()) return;
  const target = anchor.querySelector(".content") ?? anchor;
  const rect = anchor.getBoundingClientRect();
  target.dispatchEvent(
    mouseEvent("mouseout", {
      x: rect.left + rect.width / 2,
      y: rect.bottom + 20,
    }),
  );
}

/**
 * Watch for DuelingBook detaching #card_menu (opponent moves, game-state
 * changes, its own close paths) so the fan never outlives the menu.
 * Returns a disconnect function.
 */
export function watchMenuRemoval(onRemoved: () => void): () => void {
  const observer = new MutationObserver(() => {
    if (!document.getElementById("card_menu")) {
      observer.disconnect();
      onRemoved();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
