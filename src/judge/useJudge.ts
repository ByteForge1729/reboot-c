import { useCallback, useEffect, useRef, useState } from "react";
import { JudgeUnavailableError, runOnJudge } from "./client";
import { gradeSubmission, summarizeRun } from "./grade";
import type { FixtureFiles, RunReport, SubmissionReport, TestCase } from "./types";

export type JudgeState =
  | { phase: "idle" }
  | { phase: "running"; action: "run" | "submit" }
  | { phase: "ran"; report: RunReport }
  | { phase: "submitted"; report: SubmissionReport }
  | { phase: "unavailable" };

interface UseJudge {
  state: JudgeState;
  isBusy: boolean;
  run: (source: string, stdin: string, flags: string, files?: FixtureFiles) => Promise<void>;
  /** Resolves to the report when the judge was reached, null otherwise (judge rule 10). */
  submit: (source: string, tests: readonly TestCase[], flags: string) => Promise<SubmissionReport | null>;
}

/** One judge request at a time (rule 9); results arriving after unmount are dropped. */
export function useJudge(): UseJudge {
  const [state, setState] = useState<JudgeState>({ phase: "idle" });
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const guarded = useCallback(async <T,>(action: "run" | "submit", work: () => Promise<T>): Promise<T | null> => {
    if (busy.current) return null;
    busy.current = true;
    setState({ phase: "running", action });
    try {
      return await work();
    } catch (error: unknown) {
      if (!(error instanceof JudgeUnavailableError)) throw error;
      if (mounted.current) setState({ phase: "unavailable" });
      return null;
    } finally {
      busy.current = false;
    }
  }, []);

  const run = useCallback(
    async (source: string, stdin: string, flags: string, files?: FixtureFiles) => {
      await guarded("run", async () => {
        const [result] = await runOnJudge(source, [{ stdin, files }], flags);
        if (mounted.current) setState({ phase: "ran", report: summarizeRun(result) });
      });
    },
    [guarded],
  );

  const submit = useCallback(
    (source: string, tests: readonly TestCase[], flags: string) =>
      guarded("submit", async () => {
        const results = await runOnJudge(source, tests.map((t) => ({ stdin: t.stdin, files: t.files })), flags);
        const report = gradeSubmission(tests, results);
        if (mounted.current) setState({ phase: "submitted", report });
        return report;
      }),
    [guarded],
  );

  return { state, isBusy: state.phase === "running", run, submit };
}
