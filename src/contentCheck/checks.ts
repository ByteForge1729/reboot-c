import { allDrillsOf, isJudged, type Drill, type MissionContent } from "../content/lessons";
import { compilerFlagsFor, type Problem } from "../content/problems";
import { outputsMatch } from "../judge/normalize";
import type { JudgeRun, RawResult } from "../judge/types";

// What the live content check (npm run check:content) verifies, as pure data: spec/10-build-plan.md, A20.

export type CheckKind = "example" | "predict" | "fill" | "parsons" | "solution" | "starter";

export interface ContentCheck {
  id: string;
  kind: CheckKind;
  source: string;
  runs: JudgeRun[];
  flags: string;
  /** Expected stdout per run; null means only compiling (or, with mustRun, running) is checked. */
  expected: string[] | null;
  /** With no expected output: every run must still finish normally. */
  mustRun: boolean;
  /** Starters must fail at least one test, or the drill is already solved. */
  mustFail: boolean;
  /** A snippet that isn't a whole program, so a compile error is expected rather than a bug. */
  fragment: boolean;
}

export type Outcome = { status: "ok" } | { status: "problem"; detail: string } | { status: "fragment"; detail: string };

const COMPILE_ERROR = 6;
const ACCEPTED = 3;
const SNIPPET_HEADERS = "#include <stdio.h>\n#include <string.h>\n";

const hasMain = (code: string) => /\bmain\s*\(/.test(code);

/** Drills show only the interesting lines: add a main, and the usual headers, where they're left out. */
function asProgram(code: string): string {
  if (!hasMain(code)) return `${SNIPPET_HEADERS}\nint main(void) {\n${code}\nreturn 0;\n}\n`;
  return code.includes("#include") ? code : `${SNIPPET_HEADERS}\n${code}`;
}

function base(id: string, kind: CheckKind, source: string, flags: string): ContentCheck {
  return { id, kind, source, runs: [{ stdin: "" }], flags, expected: null, mustFail: false, mustRun: false, fragment: false };
}

function judgedChecks(id: string, solution: string, starter: string, tests: Problem["tests"], flags: string): ContentCheck[] {
  const runs = tests.map((t) => (t.files ? { stdin: t.stdin, files: t.files } : { stdin: t.stdin }));
  const expected = tests.map((t) => t.expected);
  return [
    { ...base(`${id} solution`, "solution", solution, flags), runs, expected },
    { ...base(`${id} starter`, "starter", starter, flags), runs, expected, mustFail: true },
  ];
}

function drillChecks(drill: Drill, missionFlags: string): ContentCheck[] {
  switch (drill.kind) {
    case "predict":
      if (drill.options) return []; // multiple choice: nothing to run
      return [{ ...base(`${drill.id} predict`, "predict", asProgram(drill.code), missionFlags), expected: [drill.answer] }];
    case "fill": {
      let blank = 0;
      const filled = drill.code.replace(/___/g, () => drill.blanks[blank++]?.[0] ?? "");
      return [{ ...base(`${drill.id} fill`, "fill", asProgram(filled), missionFlags), fragment: !hasMain(filled) }];
    }
    case "parsons": {
      const program = drill.lines.map((l) => "    ".repeat(l.indent) + l.text).join("\n");
      return hasMain(program) ? [base(`${drill.id} parsons`, "parsons", asProgram(program), missionFlags)] : [];
    }
    default:
      return isJudged(drill) ? judgedChecks(drill.id, drill.solution, drill.code, drill.tests, compilerFlagsFor(drill)) : [];
  }
}

/** Every check for one mission: lesson examples, runnable drills, judged drills and the mission's bosses. */
export function checksForMission(mission: MissionContent, problems: readonly Problem[]): ContentCheck[] {
  // Snippets run with the same extra flags as the mission's examples (-pthread in Mission 13).
  const missionFlags = compilerFlagsFor(mission.lessons[0]?.example);
  const examples = mission.lessons.map((l) => ({
    ...base(`${l.id} example`, "example", l.example.source, compilerFlagsFor(l.example)),
    runs: [{ stdin: l.example.stdin }],
    // A typed predict is the example's exact output; a multiple-choice one may ask something else ("how many lines?").
    ...(l.predict.options ? { mustRun: true } : { expected: [l.predict.answer] }),
  }));
  // A lesson's own predict has the example's code, so the example check already covers it.
  const lessonPredicts = new Set(mission.lessons.map((l) => l.predict.id));
  const drills = allDrillsOf(mission)
    .filter((d) => !lessonPredicts.has(d.id))
    .flatMap((d) => drillChecks(d, missionFlags));
  const bosses = problems
    .filter((p) => p.id.startsWith(`m${mission.missionId}-`))
    .flatMap((p) => judgedChecks(p.id, p.solution, p.starter, p.tests, compilerFlagsFor(p)));
  return [...examples, ...drills, ...bosses];
}

const show = (text: string) => JSON.stringify(text.length > 160 ? `${text.slice(0, 160)}…` : text);

function runFailure(result: RawResult, expected: string): string | null {
  if (result.statusId !== ACCEPTED) return `${result.statusDescription}${result.stderr ? `: ${result.stderr.trim()}` : ""}`;
  return outputsMatch(expected, result.stdout) ? null : `wanted ${show(expected)}, got ${show(result.stdout)}`;
}

export function evaluate(check: ContentCheck, results: readonly RawResult[]): Outcome {
  const compileError = results.find((r) => r.statusId === COMPILE_ERROR);
  if (compileError && check.mustFail) return { status: "ok" }; // fixing the compile error is the drill
  if (compileError) {
    const lines = compileError.compileOutput.trim().split("\n");
    const detail = `compile error: ${lines.find((l) => l.includes("error:")) ?? lines[0] ?? ""}`;
    return check.fragment ? { status: "fragment", detail } : { status: "problem", detail };
  }
  if (check.expected === null) {
    const crashed = check.mustRun ? results.find((r) => r.statusId !== ACCEPTED) : undefined;
    return crashed ? { status: "problem", detail: `didn't run cleanly: ${crashed.statusDescription}` } : { status: "ok" };
  }

  const failures = results.map((r, i) => runFailure(r, check.expected?.[i] ?? ""));
  const firstFailure = failures.findIndex((f) => f !== null);
  if (check.mustFail) {
    return firstFailure === -1 ? { status: "problem", detail: "the starter already passes every test" } : { status: "ok" };
  }
  return firstFailure === -1 ? { status: "ok" } : { status: "problem", detail: `test ${firstFailure + 1}: ${failures[firstFailure]}` };
}

/** "8-13", "3,5,9" or nothing (= every mission). */
export function parseMissionList(spec: string | undefined, missionCount: number): number[] {
  const all = Array.from({ length: missionCount }, (_, i) => i);
  if (spec === undefined || spec.trim() === "") return all;
  const ids = spec.split(",").flatMap((part) => {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);
    if (!match) throw new Error(`Can't read mission list "${spec}". Use e.g. 8-13 or 3,5,9.`);
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    if (to < from) throw new Error(`Range "${part.trim()}" runs backwards.`);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  });
  const outside = ids.find((id) => id < 0 || id >= missionCount);
  if (outside !== undefined || ids.length === 0) throw new Error(`Missions are 0–${missionCount - 1}; got "${spec}".`);
  return ids;
}
