import { splitActions } from "./actionsManipulations";

describe("splitActions", () => {
  it("returns simple labels unchanged", () => {
    expect(splitActions("Declare")).toEqual(["Declare"]);
  });

  it("splits plain compound labels", () => {
    expect(splitActions("To Hand/To Extra Deck")).toEqual([
      "To Hand",
      "To Extra Deck",
    ]);
    expect(splitActions("To Graveyard/To Grave/Detach")).toEqual([
      "To Graveyard",
      "To Grave",
      "Detach",
    ]);
  });

  it("keeps action names that themselves contain a slash intact", () => {
    expect(splitActions("Activate/To S/T")).toEqual(["Activate", "To S/T"]);
  });

  it("falls back to plain parts for unknown names", () => {
    expect(splitActions("Foo/Bar")).toEqual(["Foo", "Bar"]);
  });
});
