import { describe, expect, test } from "vitest";
import { checkFill, checkParsons, checkPredict, splitFill } from "./check";

describe("checkPredict (spec: lessons-and-drills rule 3)", () => {
  test("typed answers use the judge's output normalization", () => {
    expect(checkPredict({ answer: "Hello\n" }, "Hello")).toBe(true);
    expect(checkPredict({ answer: "5\n" }, "5\n\n")).toBe(true);
    expect(checkPredict({ answer: "Hello" }, "hello")).toBe(false);
  });

  test("multiple choice compares the chosen option exactly", () => {
    const drill = { answer: "B", options: ["A", "B", "C"] };

    expect(checkPredict(drill, "B")).toBe(true);
    expect(checkPredict(drill, "A")).toBe(false);
  });
});

describe("splitFill", () => {
  test("splits code around ___ blanks", () => {
    expect(splitFill("int ___ = ___;")).toEqual(["int ", " = ", ";"]);
    expect(splitFill("no blanks")).toEqual(["no blanks"]);
  });
});

describe("checkFill", () => {
  const blanks = [["int"], ["x", "y"]];

  test("accepts any listed token per blank, trimming outer spaces", () => {
    expect(checkFill(blanks, ["int", "y"])).toBe(true);
    expect(checkFill(blanks, [" int ", "x"])).toBe(true);
  });

  test("is case-sensitive, because C is", () => {
    expect(checkFill(blanks, ["Int", "x"])).toBe(false);
  });

  test("keeps inner spaces significant", () => {
    expect(checkFill([["%d\\n"]], ["%d \\n"])).toBe(false);
  });

  test("rejects a missing blank", () => {
    expect(checkFill(blanks, ["int"])).toBe(false);
  });
});

describe("checkParsons", () => {
  const solution = [
    { text: "int main(void) {", indent: 0 },
    { text: "printf(\"hi\\n\");", indent: 1 },
    { text: "return 0;", indent: 1 },
    { text: "}", indent: 0 },
  ];

  test("accepts the right order and indents", () => {
    expect(checkParsons(solution, solution)).toEqual({ correct: true, firstWrong: null });
  });

  test("flags only the first misplaced line when an indent is wrong", () => {
    const attempt = solution.map((l, i) => (i === 2 ? { ...l, indent: 0 } : l));

    expect(checkParsons(solution, attempt)).toEqual({ correct: false, firstWrong: 2 });
  });

  test("flags the first line out of order", () => {
    const attempt = [solution[0], solution[2], solution[1], solution[3]];

    expect(checkParsons(solution, attempt)).toEqual({ correct: false, firstWrong: 1 });
  });

  test("treats identical lines as interchangeable", () => {
    const twoBraces = [
      { text: "{", indent: 0 },
      { text: "}", indent: 1 },
      { text: "}", indent: 0 },
    ];
    const swapped = [twoBraces[0], { text: "}", indent: 1 }, { text: "}", indent: 0 }];

    expect(checkParsons(twoBraces, swapped).correct).toBe(true);
  });
});
