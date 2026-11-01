/** Files the program can open, by name: `{ "log.txt": "..." }`. */
export type FixtureFiles = Readonly<Record<string, string>>;

export interface TestCase {
  stdin: string;
  expected: string;
  visible: boolean;
  files?: FixtureFiles;
}

export interface JudgeRun {
  stdin: string;
  files?: FixtureFiles;
}

/** One Judge0 submission result, decoded. */
export interface RawResult {
  statusId: number;
  statusDescription: string;
  stdout: string;
  stderr: string;
  compileOutput: string;
  timeSec: number | null;
  exitCode: number | null;
}

export interface TranslatedError {
  line: number | null;
  plain: string;
  raw: string;
}

export type Verdict = "pass" | "wrong" | "timeout" | "crash" | "exit-code";

/** Input / expected / actual: only ever present for visible tests (invariant 6). */
export interface TestDetail {
  stdin: string;
  files?: FixtureFiles;
  expected: string;
  actual: string;
  firstDiffLine: number | null;
}

export interface TestRow {
  index: number;
  visible: boolean;
  verdict: Verdict;
  message: string;
  timeMs: number | null;
  detail?: TestDetail;
}

export type SubmissionReport =
  | { kind: "compile-error"; error: TranslatedError }
  | { kind: "graded"; passed: number; total: number; rows: TestRow[]; warnings: string };

export type RunReport =
  | { kind: "compile-error"; error: TranslatedError }
  | {
      kind: "ran";
      stdout: string;
      stderr: string;
      exitCode: number | null;
      timeMs: number | null;
      verdict: Exclude<Verdict, "wrong"> | "ok";
      message: string;
      warnings: string;
    };
