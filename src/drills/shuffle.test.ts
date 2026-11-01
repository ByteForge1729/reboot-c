import { describe, expect, test } from "vitest";
import { seededShuffle } from "./shuffle";

const ITEMS = ["a", "b", "c", "d", "e"];

describe("seededShuffle", () => {
  test("is a permutation of the input and leaves the input untouched", () => {
    const copy = [...ITEMS];

    const shuffled = seededShuffle(ITEMS, "m0-d3");

    expect([...shuffled].sort()).toEqual([...ITEMS].sort());
    expect(ITEMS).toEqual(copy);
  });

  test("gives the same order for the same seed, so a re-render doesn't reshuffle", () => {
    expect(seededShuffle(ITEMS, "seed")).toEqual(seededShuffle(ITEMS, "seed"));
  });

  test("never returns the original order when there are 2+ items", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      expect(seededShuffle(["x", "y"], seed)).toEqual(["y", "x"]);
      expect(seededShuffle(ITEMS, seed)).not.toEqual(ITEMS);
    }
  });

  test("handles empty and single-item lists", () => {
    expect(seededShuffle([], "s")).toEqual([]);
    expect(seededShuffle(["only"], "s")).toEqual(["only"]);
  });
});
