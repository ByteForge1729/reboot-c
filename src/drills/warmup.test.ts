import { describe, expect, test } from "vitest";
import { pickWarmup } from "./warmup";

// spec/03-data-model.md, derived value warmupPool: weight 3 if last attempt wrong, else 1.
describe("pickWarmup", () => {
  test("picks a wrongly answered drill 3x as often as a right one", () => {
    const pool = ["right", "wrong"];
    const lastWrong = new Set(["wrong"]);

    // weights: right = 1 → [0, 1), wrong = 3 → [1, 4). random r maps to r × 4.
    expect(pickWarmup(pool, lastWrong, 1, () => 0.1)).toEqual(["right"]);
    expect(pickWarmup(pool, lastWrong, 1, () => 0.3)).toEqual(["wrong"]);
  });

  test("never repeats a drill", () => {
    const picked = pickWarmup(["a", "b", "c", "d"], new Set(), 3, () => 0);

    expect(new Set(picked).size).toBe(3);
  });

  test("returns the whole pool when it has fewer than 3 drills", () => {
    expect(pickWarmup(["a", "b"], new Set(), 3, Math.random).sort()).toEqual(["a", "b"]);
    expect(pickWarmup([], new Set(), 3, Math.random)).toEqual([]);
  });
});
