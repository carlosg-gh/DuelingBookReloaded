import {
  buildEventMarkers,
  buildTimeline,
  eventKind,
  formatSeconds,
  fractionForSeconds,
  indexForSeconds,
  isCosmeticPlay,
  markerAfter,
  markerBefore,
  nextSpeed,
  prevSpeed,
  previousInterestingIndex,
  ReplayPlay,
  secondsForFraction,
  SPEED_STEPS,
} from "./replayTimeline";

function play(name: string, seconds: number, username = "alice"): ReplayPlay {
  return { play: name, seconds, username };
}

// Shape of a real two-game match, condensed.
const MATCH: ReplayPlay[] = [
  play("Pick first", 10),
  play("Start turn", 12),
  play("Draw card", 14),
  play("Duel message", 15),
  play("Normal Summon", 20),
  play("View GY", 22),
  play("Start turn", 30, "bob"),
  play("Admit defeat", 40),
  play("Siding", 45),
  play("Begin next duel", 60),
  play("Start turn", 62, "bob"),
  play("To GY", 70),
];

describe("buildTimeline", () => {
  const model = buildTimeline(MATCH);

  it("spans first to last play timestamps", () => {
    expect(model.startSeconds).toBe(10);
    expect(model.endSeconds).toBe(70);
  });

  it("numbers turns across the whole match with the turn player", () => {
    expect(model.turns).toEqual([
      { index: 1, seconds: 12, label: "Turn 1 — alice" },
      { index: 6, seconds: 30, label: "Turn 2 — bob" },
      { index: 10, seconds: 62, label: "Turn 3 — bob" },
    ]);
  });

  it("starts game 1 at play 0 and later games at their boundary", () => {
    expect(model.games).toEqual([
      { index: 0, seconds: 10, label: "Game 1" },
      { index: 9, seconds: 60, label: "Game 2" },
    ]);
  });

  it("handles an empty play list", () => {
    expect(buildTimeline([])).toEqual({
      startSeconds: 0,
      endSeconds: 0,
      turns: [],
      games: [],
    });
  });
});

describe("scrubber geometry", () => {
  const model = buildTimeline(MATCH);

  it("maps seconds to a clamped 0..1 fraction and back", () => {
    expect(fractionForSeconds(model, 10)).toBe(0);
    expect(fractionForSeconds(model, 70)).toBe(1);
    expect(fractionForSeconds(model, 40)).toBeCloseTo(0.5);
    expect(fractionForSeconds(model, 9000)).toBe(1);
    expect(secondsForFraction(model, 0.5)).toBeCloseTo(40);
    expect(secondsForFraction(model, -1)).toBe(10);
  });

  it("is safe on a single-play timeline", () => {
    const single = buildTimeline([play("Pick first", 10)]);
    expect(fractionForSeconds(single, 10)).toBe(0);
    expect(secondsForFraction(single, 0.7)).toBe(10);
  });

  it("finds the first play at or after a timestamp", () => {
    expect(indexForSeconds(MATCH, 10)).toBe(0);
    expect(indexForSeconds(MATCH, 21)).toBe(5);
    expect(indexForSeconds(MATCH, 9000)).toBe(MATCH.length - 1);
  });
});

describe("stepping and markers", () => {
  it("skips cosmetic plays when stepping backward", () => {
    // from "Normal Summon" (4): previous interesting is "Draw card" (2),
    // skipping the chat message at 3
    expect(previousInterestingIndex(MATCH, 4)).toBe(2);
    // from "Start turn" (6): the View play at 5 is cosmetic
    expect(previousInterestingIndex(MATCH, 6)).toBe(4);
    expect(previousInterestingIndex(MATCH, 0)).toBe(-1);
  });

  it("classifies cosmetic plays including View*", () => {
    expect(isCosmeticPlay(play("Duel message", 1))).toBe(true);
    expect(isCosmeticPlay(play("View GY 2", 1))).toBe(true);
    expect(isCosmeticPlay(play("Normal Summon", 1))).toBe(false);
  });

  it("finds the turn marker before/after an index", () => {
    const { turns } = buildTimeline(MATCH);
    expect(markerBefore(turns, 6)?.label).toBe("Turn 1 — alice");
    expect(markerBefore(turns, 1)).toBeNull();
    expect(markerAfter(turns, 1)?.label).toBe("Turn 2 — bob");
    expect(markerAfter(turns, 10)).toBeNull();
  });
});

describe("speed steps", () => {
  it("moves through presets and clamps at the ends", () => {
    expect(nextSpeed(1)).toBe(1.5);
    expect(nextSpeed(4)).toBe(4);
    expect(prevSpeed(1)).toBe(0.5);
    expect(prevSpeed(0.5)).toBe(0.5);
    // off-preset values snap to the nearest neighbour in the direction
    expect(nextSpeed(1.2)).toBe(1.5);
    expect(prevSpeed(1.2)).toBe(1);
    expect(SPEED_STEPS).toContain(1);
  });
});

describe("event markers", () => {
  it("classifies plays into icon categories", () => {
    expect(eventKind(play("Normal Summon", 1))).toBe("summon");
    expect(eventKind(play("SS ATK", 1))).toBe("summon");
    expect(eventKind(play("OL DEF", 1))).toBe("summon");
    expect(eventKind(play("Summon Token", 1))).toBe("summon");
    expect(eventKind(play("Activate ST", 1))).toBe("activation");
    expect(eventKind(play("Activate Field Spell", 1))).toBe("activation");
    expect(eventKind(play("Declare", 1))).toBe("activation");
    expect(eventKind(play("Attack directly", 1))).toBe("attack");
    expect(eventKind(play("Enter BP", 1))).toBe("phase");
    expect(eventKind(play("Enter M2", 1))).toBe("phase");
    expect(eventKind(play("Life points", 1))).toBe("lp");
    // no icons for structure, cosmetics, or card movement
    expect(eventKind(play("Start turn", 1))).toBeNull();
    expect(eventKind(play("Duel message", 1))).toBeNull();
    expect(eventKind(play("To GY", 1))).toBeNull();
  });

  it("labels markers from the play's public log with the actor", () => {
    const plays: ReplayPlay[] = [
      { play: "Draw card", seconds: 10, username: "alice" },
      {
        play: "Normal Summon",
        seconds: 12,
        username: "alice",
        log: { public_log: 'Normal Summoned "Blue-Eyes White Dragon"' },
      },
      { play: "Enter BP", seconds: 20, username: "alice", log: {} },
    ];
    expect(buildEventMarkers(plays)).toEqual([
      {
        index: 1,
        seconds: 12,
        kind: "summon",
        label: 'alice — Normal Summoned "Blue-Eyes White Dragon"',
      },
      // empty log falls back to the play name
      { index: 2, seconds: 20, kind: "phase", label: "alice — Enter BP" },
    ]);
  });

  it("strips zone references from labels", () => {
    const plays: ReplayPlay[] = [
      {
        play: "Summon Token",
        seconds: 5,
        username: "bob",
        log: { public_log: "Summoned a token in M-2" },
      },
      {
        play: "Activate ST",
        seconds: 8,
        username: "bob",
        log: { public_log: 'Activated "Trap Trick" from S-3' },
      },
    ];
    expect(buildEventMarkers(plays).map((marker) => marker.label)).toEqual([
      "bob — Summoned a token",
      'bob — Activated "Trap Trick"',
    ]);
  });
});

describe("formatSeconds", () => {
  it("formats m:ss", () => {
    expect(formatSeconds(0)).toBe("0:00");
    expect(formatSeconds(65)).toBe("1:05");
    expect(formatSeconds(3346)).toBe("55:46");
  });
});
