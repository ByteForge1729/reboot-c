import { describe, expect, test } from "vitest";
import type { MissionContent } from "../content/lessons";
import type { Problem } from "../content/problems";
import type { RawResult } from "../judge/types";
import { checksForMission, evaluate, parseMissionList, type ContentCheck } from "./checks";

const EXAMPLE = '#include <stdio.h>\nint main(void) { printf("hi\\n"); return 0; }\n';

const mission: MissionContent = {
  missionId: 1,
  cheatsheet: "x",
  lessons: [
    {
      id: "m1-l1",
      title: "T",
      concept: "C",
      example: { source: EXAMPLE, stdin: "5\n", compileFlags: "-pthread" },
      predict: { id: "m1-p1", kind: "predict", prompt: "p", code: EXAMPLE, answer: "hi\n", explain: "e", warmupEligible: false },
      drills: [
        { id: "m1-d1", kind: "predict", prompt: "p", code: 'printf("%d\\n", 2 + 2);', answer: "4\n", explain: "e", warmupEligible: true },
        { id: "m1-d2", kind: "predict", prompt: "p", code: "int x;", options: ["a", "b"], answer: "a", explain: "e", warmupEligible: true },
        { id: "m1-d3", kind: "fill", prompt: "p", code: "int x = ___;\nfree(___);", blanks: [["5", "6"], ["p"]], explain: "e", warmupEligible: true },
        {
          id: "m1-d4",
          kind: "parsons",
          prompt: "p",
          lines: [
            { text: "int main(void) {", indent: 0 },
            { text: "return 0;", indent: 1 },
            { text: "}", indent: 0 },
          ],
          explain: "e",
          warmupEligible: true,
        },
        {
          id: "m1-d5",
          kind: "parsons",
          prompt: "p",
          lines: [
            { text: "while (x) {", indent: 0 },
            { text: "x--;", indent: 1 },
            { text: "}", indent: 0 },
          ],
          explain: "e",
          warmupEligible: true,
        },
        {
          id: "m1-d6",
          kind: "fix",
          prompt: "p",
          code: "starter",
          solution: "solution",
          compileFlags: "-pthread",
          tests: [{ stdin: "", expected: "1\n", visible: true, files: { "log.txt": "a\n" } }],
          explain: "e",
          warmupEligible: true,
        },
      ],
    },
  ],
  checkpoint: [],
};

const problem = (id: string): Problem => ({
  id,
  title: "B",
  difficulty: "easy",
  story: "s",
  starter: `starter ${id}`,
  solution: `solution ${id}`,
  hints: ["a", "b", "c"],
  tests: [
    { stdin: "1\n", expected: "2\n", visible: true },
    { stdin: "2\n", expected: "3\n", visible: false },
  ],
});

const byId = (checks: ContentCheck[], id: string) => checks.find((c) => c.id === id);

describe("checksForMission", () => {
  const checks = checksForMission(mission, [problem("m1-b1"), problem("m10-b1"), problem("m11-b2")]);

  test("runs each lesson example with its own input and flags, expecting the predict answer", () => {
    expect(byId(checks, "m1-l1 example")).toMatchObject({
      source: EXAMPLE,
      runs: [{ stdin: "5\n" }],
      flags: "-std=gnu17 -Wall -O0 -lm -pthread",
      expected: ["hi\n"],
      mustFail: false,
    });
  });

  test("an example whose predict is multiple choice only has to run cleanly (the answer may not be output)", () => {
    const mc = { ...mission, lessons: [{ ...mission.lessons[0], predict: { ...mission.lessons[0].predict, options: ["1", "2"], answer: "1" } }] };

    expect(byId(checksForMission(mc, []), "m1-l1 example")).toMatchObject({ expected: null, mustRun: true });
  });

  test("wraps typed snippet predicts in main with the mission's flags, and skips multiple choice and lesson predicts", () => {
    const snippet = byId(checks, "m1-d1 predict");

    expect(snippet?.source).toContain("int main(void) {");
    expect(snippet?.source).toContain("#include <stdio.h>");
    expect(snippet?.flags).toContain("-pthread");
    expect(snippet?.expected).toEqual(["4\n"]);
    expect(byId(checks, "m1-d2 predict")).toBeUndefined();
    expect(byId(checks, "m1-p1 predict")).toBeUndefined();
  });

  test("fills blanks with the first accepted answer and only compiles, flagging fragments", () => {
    const fill = byId(checks, "m1-d3 fill");

    expect(fill?.source).toContain("int x = 5;\nfree(p);");
    expect(fill?.expected).toBeNull();
    expect(fill?.fragment).toBe(true);
  });

  test("compiles whole-program parsons answers with their indentation (adding headers they leave out) and skips fragments", () => {
    expect(byId(checks, "m1-d4 parsons")?.source).toBe("#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    return 0;\n}");
    expect(byId(checks, "m1-d5 parsons")).toBeUndefined();
  });

  test("checks judged drills both ways: solution must pass, starter must fail, with fixture files and flags", () => {
    expect(byId(checks, "m1-d6 solution")).toMatchObject({ source: "solution", mustFail: false, runs: [{ stdin: "", files: { "log.txt": "a\n" } }], expected: ["1\n"] });
    expect(byId(checks, "m1-d6 starter")).toMatchObject({ source: "starter", mustFail: true });
    expect(byId(checks, "m1-d6 solution")?.flags).toContain("-pthread");
  });

  test("includes only this mission's bosses (m1 is not m10)", () => {
    expect(byId(checks, "m1-b1 solution")?.expected).toEqual(["2\n", "3\n"]);
    expect(byId(checks, "m1-b1 starter")?.mustFail).toBe(true);
    expect(checks.some((c) => c.id.startsWith("m10-") || c.id.startsWith("m11-"))).toBe(false);
  });
});

function result(overrides: Partial<RawResult> = {}): RawResult {
  return { statusId: 3, statusDescription: "Accepted", stdout: "", stderr: "", compileOutput: "", timeSec: 0.01, exitCode: 0, ...overrides };
}
const check = (overrides: Partial<ContentCheck>): ContentCheck => ({
  id: "x",
  kind: "solution",
  source: "s",
  runs: [{ stdin: "" }, { stdin: "" }],
  flags: "",
  expected: ["1\n", "2\n"],
  mustFail: false,
  mustRun: false,
  fragment: false,
  ...overrides,
});

describe("evaluate", () => {
  test("passes a solution whose every run matches, ignoring trailing whitespace", () => {
    expect(evaluate(check({}), [result({ stdout: "1  \n" }), result({ stdout: "2\n\n" })])).toEqual({ status: "ok" });
  });

  test("reports the first failing test of a solution, with what it printed and what was wanted", () => {
    const outcome = evaluate(check({}), [result({ stdout: "1\n" }), result({ stdout: "7\n" })]);

    expect(outcome.status).toBe("problem");
    expect(outcome.status === "problem" && outcome.detail).toMatch(/test 2.*wanted "2\\n".*got "7\\n"/s);
  });

  test("reports crashes and compile errors on a solution", () => {
    expect(evaluate(check({}), [result({ statusId: 11, statusDescription: "Runtime Error (NZEC)", stderr: "Segmentation fault" }), result()]).status).toBe("problem");
    const output = "main.c: In function 'main':\nmain.c:3:5: error: 'x' undeclared\n    3 | x;";
    const compile = evaluate(check({}), [result({ statusId: 6, compileOutput: output }), result({ statusId: 6 })]);
    expect(compile).toEqual({ status: "problem", detail: "compile error: main.c:3:5: error: 'x' undeclared" });
  });

  test("a starter is fine when it fails at least one test, and a problem when it already passes", () => {
    expect(evaluate(check({ mustFail: true }), [result({ stdout: "1\n" }), result({ stdout: "0\n" })])).toEqual({ status: "ok" });
    expect(evaluate(check({ mustFail: true }), [result({ stdout: "1\n" }), result({ stdout: "2\n" })]).status).toBe("problem");
  });

  test("a starter that doesn't even compile counts as failing (fixing the compile error is the drill)", () => {
    expect(evaluate(check({ mustFail: true }), [result({ statusId: 6, compileOutput: "error" }), result({ statusId: 6 })])).toEqual({ status: "ok" });
  });

  test("a run-only check needs every run to finish normally, whatever it prints", () => {
    const runOnly = check({ kind: "example", expected: null, mustRun: true, runs: [{ stdin: "" }] });

    expect(evaluate(runOnly, [result({ stdout: "anything" })])).toEqual({ status: "ok" });
    expect(evaluate(runOnly, [result({ statusId: 5, statusDescription: "Time Limit Exceeded" })]).status).toBe("problem");
  });

  test("compile-only checks: fragments that don't compile are only a warning", () => {
    const compileOnly = (fragment: boolean) => check({ kind: "fill", expected: null, runs: [{ stdin: "" }], fragment });

    expect(evaluate(compileOnly(false), [result({ statusId: 11 })])).toEqual({ status: "ok" });
    expect(evaluate(compileOnly(true), [result({ statusId: 6, compileOutput: "undeclared" })]).status).toBe("fragment");
    expect(evaluate(compileOnly(false), [result({ statusId: 6, compileOutput: "undeclared" })]).status).toBe("problem");
  });
});

describe("parseMissionList", () => {
  test("defaults to every mission and understands ranges and lists", () => {
    expect(parseMissionList(undefined, 14)).toHaveLength(14);
    expect(parseMissionList("8-13", 14)).toEqual([8, 9, 10, 11, 12, 13]);
    expect(parseMissionList("3, 5,9", 14)).toEqual([3, 5, 9]);
  });

  test("rejects anything outside the course", () => {
    expect(() => parseMissionList("12-15", 14)).toThrow(/0–13/);
    expect(() => parseMissionList("abc", 14)).toThrow();
    expect(() => parseMissionList("9-3", 14)).toThrow(/backwards/);
  });
});
