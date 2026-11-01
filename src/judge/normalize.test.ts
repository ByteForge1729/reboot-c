import { describe, expect, test } from "vitest";
import { firstDifferingLine, normalize, outputsMatch } from "./normalize";

describe("outputsMatch (A8, spec/04-features/judge.md rule 5)", () => {
  test.each([
    ["5\n", "5", true],
    ["5 7", "5  7", false],
    ["", "\n\n", true],
    ["a\r\nb\r\n", "a\nb", true],
    ["x  \t\ny", "x\ny", true],
    ["O2: 42%", "O2: 42", false],
    ["  lead", "lead", false],
  ])("expected %j vs output %j → %s", (expected, actual, match) => {
    expect(outputsMatch(expected, actual)).toBe(match);
  });
});

describe("normalize", () => {
  test("removes trailing blank lines but keeps blank lines in the middle", () => {
    expect(normalize("a\n\nb\n\n\n")).toBe("a\n\nb");
  });
});

describe("firstDifferingLine", () => {
  test("is 1-based and null when outputs match", () => {
    expect(firstDifferingLine("a\nb\nc", "a\nB\nc")).toBe(2);
    expect(firstDifferingLine("a\nb", "a\nb\n")).toBeNull();
  });

  test("points past the end when one output is shorter", () => {
    expect(firstDifferingLine("a\nb", "a")).toBe(2);
  });
});
