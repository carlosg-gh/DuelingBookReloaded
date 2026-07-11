/**
 * Radial fan geometry for the touchscreen action fan. Pure math — all
 * coordinates are viewport pixels (getBoundingClientRect space, y grows
 * down), so the layout is independent of DuelingBook's board scaling.
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface FanLayout {
  /** Button center positions, in the same order as the input items. */
  positions: Point[];
  mode: "ring" | "grid";
}

const ANGLE_STEP_DEG = 5;
const RADIUS_GROWTH = 32;
const MAX_RADIUS_TRIES = 6;
const RING_GAP = 10;
const ANCHOR_CLEARANCE = 12;

function buttonFits(
  center: Point,
  button: Size,
  viewport: Size,
  margin: number,
): boolean {
  return (
    center.x - button.width / 2 >= margin &&
    center.x + button.width / 2 <= viewport.width - margin &&
    center.y - button.height / 2 >= margin &&
    center.y + button.height / 2 <= viewport.height - margin
  );
}

/**
 * Largest contiguous run of `true` in a circular boolean array; returns
 * [startIndex, length]. Scans the doubled array to handle wrap-around.
 */
function largestCircularRun(feasible: boolean[]): [number, number] {
  const n = feasible.length;
  let bestStart = 0;
  let bestLen = 0;
  let runStart = 0;
  let runLen = 0;
  for (let i = 0; i < 2 * n; i++) {
    if (feasible[i % n]) {
      if (runLen === 0) runStart = i;
      runLen++;
      if (runLen > bestLen) {
        bestLen = runLen;
        bestStart = runStart;
      }
      if (runLen === n) break; // fully feasible circle
    } else {
      runLen = 0;
    }
  }
  return [bestStart % n, Math.min(bestLen, n)];
}

/** Difference between two angles, wrapped to (-π, π]. */
function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  return d;
}

function layoutRing(
  anchor: Rect,
  viewport: Size,
  count: number,
  button: Size,
  margin: number,
): Point[] | null {
  const cx = anchor.left + anchor.width / 2;
  const cy = anchor.top + anchor.height / 2;
  const anchorHalfDiagonal = Math.hypot(anchor.width, anchor.height) / 2;
  const baseRadius = anchorHalfDiagonal + button.height / 2 + ANCHOR_CLEARANCE;
  // center spacing between ring neighbors: buttons render as circles
  // inscribed in their box, so centers at least a diameter (+gap) apart can
  // never overlap
  const spacing = Math.max(button.width, button.height) + RING_GAP;
  // fan toward wherever there is room: aim at the viewport center
  const targetAngle = Math.atan2(
    viewport.height / 2 - cy,
    viewport.width / 2 - cx,
  );

  const stepRad = (ANGLE_STEP_DEG * Math.PI) / 180;
  const samples = Math.round((2 * Math.PI) / stepRad);

  for (let attempt = 0; attempt < MAX_RADIUS_TRIES; attempt++) {
    const radius = baseRadius + attempt * RADIUS_GROWTH;
    const feasible: boolean[] = [];
    for (let i = 0; i < samples; i++) {
      const angle = i * stepRad;
      feasible.push(
        buttonFits(
          {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle),
          },
          button,
          viewport,
          margin,
        ),
      );
    }

    const [runStart, runLen] = largestCircularRun(feasible);
    if (runLen === 0) continue;

    const windowStart = runStart * stepRad;
    const windowSpan = (runLen - 1) * stepRad;
    const delta = 2 * Math.asin(Math.min(1, spacing / (2 * radius)));
    const neededSpan = (count - 1) * delta;
    if (count > 1 && neededSpan > windowSpan) continue;

    // slide the used sub-arc as close to the target direction as possible
    let arcStart: number;
    if (count === 1) {
      const clamped = Math.min(
        Math.max(angleDelta(windowStart, targetAngle), 0),
        windowSpan,
      );
      arcStart = windowStart + clamped;
    } else {
      const idealStart = targetAngle - neededSpan / 2;
      const offset = Math.min(
        Math.max(angleDelta(windowStart, idealStart), 0),
        windowSpan - neededSpan,
      );
      arcStart = windowStart + offset;
    }

    const positions: Point[] = [];
    for (let i = 0; i < count; i++) {
      const angle = arcStart + i * delta;
      positions.push({
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    }
    return positions;
  }
  return null;
}

function layoutGrid(
  anchor: Rect,
  viewport: Size,
  count: number,
  button: Size,
  margin: number,
): Point[] {
  const gap = RING_GAP;
  const usableWidth = viewport.width - 2 * margin;
  const perRow = Math.max(
    1,
    Math.floor((usableWidth + gap) / (button.width + gap)),
  );
  const rows = Math.ceil(count / perRow);
  const rowHeight = button.height + gap;

  // stack rows on whichever side of the anchor has more room
  const spaceAbove = anchor.top;
  const spaceBelow = viewport.height - (anchor.top + anchor.height);
  const above = spaceAbove >= spaceBelow;
  let firstRowY = above
    ? anchor.top - ANCHOR_CLEARANCE - button.height / 2 - (rows - 1) * rowHeight
    : anchor.top + anchor.height + ANCHOR_CLEARANCE + button.height / 2;
  // clamp the whole block into the viewport
  const blockTop = firstRowY - button.height / 2;
  const blockBottom = firstRowY + (rows - 1) * rowHeight + button.height / 2;
  if (blockTop < margin) firstRowY += margin - blockTop;
  else if (blockBottom > viewport.height - margin)
    firstRowY -= blockBottom - (viewport.height - margin);

  const cx = anchor.left + anchor.width / 2;
  const positions: Point[] = [];
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(perRow, count - row * perRow);
    const rowWidth = inRow * button.width + (inRow - 1) * gap;
    let startX = cx - rowWidth / 2 + button.width / 2;
    // clamp the row horizontally
    if (startX - button.width / 2 < margin) startX = margin + button.width / 2;
    const endX = startX + (inRow - 1) * (button.width + gap);
    if (endX + button.width / 2 > viewport.width - margin)
      startX -= endX + button.width / 2 - (viewport.width - margin);
    for (let i = 0; i < inRow; i++) {
      positions.push({
        x: startX + i * (button.width + gap),
        y: firstRowY + row * rowHeight,
      });
    }
  }
  return positions;
}

/**
 * Lay out `count` fan buttons around `anchor`. Tries a ring (largest
 * viewport-feasible arc facing the viewport center, radius grown until the
 * buttons fit); falls back to a wrapped grid beside the anchor when no ring
 * fits (small viewports / many actions).
 */
export function layoutFan(
  anchor: Rect,
  viewport: Size,
  count: number,
  button: Size,
  margin = 8,
): FanLayout {
  if (count <= 0) return { positions: [], mode: "ring" };
  const ring = layoutRing(anchor, viewport, count, button, margin);
  if (ring) return { positions: ring, mode: "ring" };
  return {
    positions: layoutGrid(anchor, viewport, count, button, margin),
    mode: "grid",
  };
}
