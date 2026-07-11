import { layoutFan, Point, Rect, Size } from "./touchFanLayout";

// square boxes rendered as circles (mirrors touchFanOverlay's BUTTON)
const BUTTON: Size = { width: 110, height: 110 };
const VIEWPORT: Size = { width: 1920, height: 937 };
const MARGIN = 8;

// minimum center spacing the ring promises (mirrors the module's constant):
// a full diameter + gap, so circular buttons can never overlap
const MIN_SPACING = Math.max(BUTTON.width, BUTTON.height) + 10;

function expectAllInViewport(positions: Point[], viewport: Size) {
  for (const p of positions) {
    expect(p.x - BUTTON.width / 2).toBeGreaterThanOrEqual(MARGIN);
    expect(p.x + BUTTON.width / 2).toBeLessThanOrEqual(viewport.width - MARGIN);
    expect(p.y - BUTTON.height / 2).toBeGreaterThanOrEqual(MARGIN);
    expect(p.y + BUTTON.height / 2).toBeLessThanOrEqual(
      viewport.height - MARGIN,
    );
  }
}

function expectSpacing(positions: Point[], min: number) {
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dist = Math.hypot(
        positions[i].x - positions[j].x,
        positions[i].y - positions[j].y,
      );
      expect(dist).toBeGreaterThanOrEqual(min - 1e-6);
    }
  }
}

describe("layoutFan (ring)", () => {
  // a hand card at the bottom-center of the board
  const handCard: Rect = { left: 830, top: 790, width: 105, height: 147 };

  it("fits 13 buttons around a bottom-edge hand card, all in-viewport", () => {
    const layout = layoutFan(handCard, VIEWPORT, 13, BUTTON, MARGIN);
    expect(layout.positions).toHaveLength(13);
    expectAllInViewport(layout.positions, VIEWPORT);
    expectSpacing(layout.positions, MIN_SPACING);
  });

  it("keeps a small fan close and in-viewport", () => {
    const layout = layoutFan(handCard, VIEWPORT, 4, BUTTON, MARGIN);
    expect(layout.mode).toBe("ring");
    expect(layout.positions).toHaveLength(4);
    expectAllInViewport(layout.positions, VIEWPORT);
    expectSpacing(layout.positions, MIN_SPACING);
    // all buttons should sit above the bottom-edge card (fanning inward)
    const cardCenterY = handCard.top + handCard.height / 2;
    for (const p of layout.positions) {
      expect(p.y).toBeLessThan(cardCenterY);
    }
  });

  it("handles a top-left corner anchor", () => {
    const corner: Rect = { left: 0, top: 0, width: 105, height: 147 };
    const layout = layoutFan(corner, VIEWPORT, 8, BUTTON, MARGIN);
    expect(layout.positions).toHaveLength(8);
    expectAllInViewport(layout.positions, VIEWPORT);
    expectSpacing(layout.positions, MIN_SPACING);
  });

  it("handles a bottom-right corner anchor", () => {
    const corner: Rect = { left: 1815, top: 790, width: 105, height: 147 };
    const layout = layoutFan(corner, VIEWPORT, 8, BUTTON, MARGIN);
    expect(layout.positions).toHaveLength(8);
    expectAllInViewport(layout.positions, VIEWPORT);
    expectSpacing(layout.positions, MIN_SPACING);
  });

  it("is deterministic", () => {
    const a = layoutFan(handCard, VIEWPORT, 9, BUTTON, MARGIN);
    const b = layoutFan(handCard, VIEWPORT, 9, BUTTON, MARGIN);
    expect(a).toEqual(b);
  });

  it("returns an empty layout for zero items", () => {
    expect(layoutFan(handCard, VIEWPORT, 0, BUTTON, MARGIN).positions).toEqual(
      [],
    );
  });
});

describe("layoutFan (grid fallback)", () => {
  // phone-landscape viewport: no ring can hold 15 circles here
  const smallViewport: Size = { width: 844, height: 390 };
  const anchor: Rect = { left: 380, top: 280, width: 80, height: 110 };

  it("falls back to a grid when no ring fits", () => {
    const layout = layoutFan(anchor, smallViewport, 15, BUTTON, MARGIN);
    expect(layout.mode).toBe("grid");
    expect(layout.positions).toHaveLength(15);
    expectAllInViewport(layout.positions, smallViewport);
  });

  it("grid buttons never overlap", () => {
    const layout = layoutFan(anchor, smallViewport, 15, BUTTON, MARGIN);
    for (let i = 0; i < layout.positions.length; i++) {
      for (let j = i + 1; j < layout.positions.length; j++) {
        const a = layout.positions[i];
        const b = layout.positions[j];
        const overlapX = Math.abs(a.x - b.x) < BUTTON.width;
        const overlapY = Math.abs(a.y - b.y) < BUTTON.height;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });
});
