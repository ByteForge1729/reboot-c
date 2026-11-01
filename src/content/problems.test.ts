import { describe, expect, test } from "vitest";
import { PROBLEMS, compilerFlagsFor, problemById } from "./problems";

describe("problem content", () => {
  test("every problem file is valid and ids are unique", () => {
    const ids = PROBLEMS.map((p) => p.id);

    expect(PROBLEMS.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every problem has at least one visible example and exactly 3 hints", () => {
    for (const problem of PROBLEMS) {
      expect(problem.tests.some((t) => t.visible), problem.id).toBe(true);
      expect(problem.hints, problem.id).toHaveLength(3);
    }
  });

  test("looks problems up by id", () => {
    expect(problemById("m1-b1")?.title).toBe("Oxygen Readout");
    expect(problemById("m9-b9")).toBeUndefined();
  });
});

describe("compilerFlagsFor (A19)", () => {
  test("uses gnu17 by default and adds problem-specific flags", () => {
    expect(compilerFlagsFor(undefined)).toBe("-std=gnu17 -Wall -O0 -lm");
    expect(compilerFlagsFor({ compileFlags: "-pthread" })).toBe("-std=gnu17 -Wall -O0 -lm -pthread");
  });
});
