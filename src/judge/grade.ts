import { firstDifferingLine, outputsMatch } from "./normalize";
import { translateCompileError } from "./translate";
import type { RawResult, RunReport, SubmissionReport, TestCase, TestRow, Verdict } from "./types";

// Judge0 status ids (GET /statuses).
const ACCEPTED = 3;
const TIME_LIMIT = 5;
const COMPILE_ERROR = 6;
const SIGSEGV = 7;
const SIGXFSZ = 8;
const SIGFPE = 9;
const SIGABRT = 10;
const NON_ZERO_EXIT = 11;

interface Outcome {
  verdict: Exclude<Verdict, "pass" | "wrong">;
  message: string;
}

/** Plain-words outcome for anything other than a clean finish; null when the program ran to completion. */
function abnormalOutcome(result: RawResult): Outcome | null {
  switch (result.statusId) {
    case ACCEPTED:
      return null;
    case TIME_LIMIT:
      return { verdict: "timeout", message: "Took longer than 2 s: is a loop never ending?" };
    case SIGSEGV:
      return { verdict: "crash", message: "Crashed: usually an array index past the end or a bad pointer." };
    case SIGXFSZ:
      return { verdict: "crash", message: "Printed far too much output." };
    case SIGFPE:
      return { verdict: "crash", message: "Crashed: division by zero." };
    case SIGABRT:
      return { verdict: "crash", message: "Program aborted (abort() was called or an assert failed)." };
    case NON_ZERO_EXIT:
      return { verdict: "exit-code", message: `Program ended with code ${result.exitCode ?? "?"} (main should return 0).` };
    default:
      return { verdict: "crash", message: `Program crashed (${result.statusDescription}).` };
  }
}

const toMs = (seconds: number | null): number | null => (seconds === null ? null : Math.round(seconds * 1000));

function gradeOne(test: TestCase, result: RawResult, index: number): TestRow {
  const abnormal = abnormalOutcome(result);
  const passed = abnormal === null && outputsMatch(test.expected, result.stdout);
  const verdict: Verdict = abnormal?.verdict ?? (passed ? "pass" : "wrong");
  const message = abnormal?.message ?? (passed ? "Passed" : "Wrong output");
  const row: TestRow = { index, visible: test.visible, verdict, message, timeMs: toMs(result.timeSec) };
  if (passed || !test.visible) return row;
  return {
    ...row,
    detail: {
      stdin: test.stdin,
      ...(test.files ? { files: test.files } : {}),
      expected: test.expected,
      actual: result.stdout,
      firstDiffLine: firstDifferingLine(test.expected, result.stdout),
    },
  };
}

export function gradeSubmission(tests: readonly TestCase[], results: readonly RawResult[]): SubmissionReport {
  const compileFailure = results.find((r) => r.statusId === COMPILE_ERROR);
  if (compileFailure) return { kind: "compile-error", error: translateCompileError(compileFailure.compileOutput) };

  const rows = tests.map((test, i) => gradeOne(test, results[i], i));
  return {
    kind: "graded",
    passed: rows.filter((r) => r.verdict === "pass").length,
    total: rows.length,
    rows,
    warnings: results.find((r) => r.compileOutput)?.compileOutput ?? "",
  };
}

export function summarizeRun(result: RawResult): RunReport {
  if (result.statusId === COMPILE_ERROR) return { kind: "compile-error", error: translateCompileError(result.compileOutput) };
  const abnormal = abnormalOutcome(result);
  return {
    kind: "ran",
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    timeMs: toMs(result.timeSec),
    verdict: abnormal?.verdict ?? "ok",
    message: abnormal?.message ?? "Finished",
    warnings: result.compileOutput,
  };
}
