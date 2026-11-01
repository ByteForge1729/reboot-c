import { describe, expect, test } from "vitest";
import { gradeSubmission, summarizeRun } from "./grade";
import type { RawResult, TestCase } from "./types";

function result(overrides: Partial<RawResult> = {}): RawResult {
  return {
    statusId: 3,
    statusDescription: "Accepted",
    stdout: "",
    stderr: "",
    compileOutput: "",
    timeSec: 0.002,
    exitCode: 0,
    ...overrides,
  };
}

const TESTS: TestCase[] = [
  { stdin: "2 3", expected: "5", visible: true },
  { stdin: "40 2", expected: "42", visible: false },
];

describe("gradeSubmission", () => {
  test("counts every passing test", () => {
    const report = gradeSubmission(TESTS, [result({ stdout: "5\n" }), result({ stdout: "42\n" })]);

    expect(report).toMatchObject({ kind: "graded", passed: 2, total: 2 });
  });

  test("shows input, expected and actual for a failing visible test, with the first differing line", () => {
    const report = gradeSubmission(TESTS, [result({ stdout: "6\n" }), result({ stdout: "42" })]);

    if (report.kind !== "graded") throw new Error("expected graded");
    expect(report.passed).toBe(1);
    expect(report.rows[0]).toMatchObject({
      verdict: "wrong",
      detail: { stdin: "2 3", expected: "5", actual: "6\n", firstDiffLine: 1 },
    });
  });

  test("includes a failing visible test's fixture files so he can see what the program opened", () => {
    const files = { "log.txt": "ERROR a\n" };
    const report = gradeSubmission([{ stdin: "", expected: "1", visible: true, files }], [result({ stdout: "0\n" })]);

    expect(report.kind === "graded" && report.rows[0].detail?.files).toEqual(files);
  });

  test("never exposes hidden test data (invariant 6)", () => {
    const report = gradeSubmission(TESTS, [result({ stdout: "5" }), result({ stdout: "99" })]);

    if (report.kind !== "graded") throw new Error("expected graded");
    const hidden = report.rows[1];
    expect(hidden.verdict).toBe("wrong");
    expect(hidden.detail).toBeUndefined();
    expect(JSON.stringify(hidden)).not.toContain("40 2");
    expect(JSON.stringify(hidden)).not.toContain("42");
  });

  test("reports a compile error once instead of per test", () => {
    const compileOutput = "main.c:2:28: error: expected ';' before 'return'";
    const failed = result({ statusId: 6, statusDescription: "Compilation Error", compileOutput, exitCode: null });

    const report = gradeSubmission(TESTS, [failed, failed]);

    expect(report.kind).toBe("compile-error");
    if (report.kind === "compile-error") expect(report.error.line).toBe(2);
  });

  test("explains timeouts, segfaults and non-zero exits in plain words", () => {
    const report = gradeSubmission(
      [...TESTS, { stdin: "", expected: "", visible: true }],
      [
        result({ statusId: 5, statusDescription: "Time Limit Exceeded", timeSec: 2.07 }),
        result({ statusId: 7, statusDescription: "Runtime Error (SIGSEGV)", exitCode: null }),
        result({ statusId: 11, statusDescription: "Runtime Error (NZEC)", exitCode: 3 }),
      ],
    );

    if (report.kind !== "graded") throw new Error("expected graded");
    expect(report.rows.map((r) => r.verdict)).toEqual(["timeout", "crash", "exit-code"]);
    expect(report.rows[0].message).toBe("Took longer than 2 s: is a loop never ending?");
    expect(report.rows[1].message).toContain("array index past the end or a bad pointer");
    expect(report.rows[2].message).toBe("Program ended with code 3 (main should return 0).");
  });

  test("keeps compiler warnings from an otherwise successful build", () => {
    const warning = "main.c:3:9: warning: unused variable 'x' [-Wunused-variable]";
    const report = gradeSubmission(TESTS, [
      result({ stdout: "5", compileOutput: warning }),
      result({ stdout: "42", compileOutput: warning }),
    ]);

    expect(report).toMatchObject({ kind: "graded", passed: 2, warnings: warning });
  });
});

describe("summarizeRun", () => {
  test("returns output and timing for a normal run", () => {
    const report = summarizeRun(result({ stdout: "hello\n", timeSec: 0.012 }));

    expect(report).toMatchObject({ kind: "ran", verdict: "ok", stdout: "hello\n", timeMs: 12 });
  });

  test("returns the translated compile error", () => {
    const report = summarizeRun(
      result({ statusId: 6, compileOutput: "main.c:1:1: error: expected ';' before '}' token", exitCode: null }),
    );

    expect(report.kind).toBe("compile-error");
  });
});
