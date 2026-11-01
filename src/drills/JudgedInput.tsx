import { Suspense, lazy } from "react";
import type { JudgedDrill } from "../content/lessons";
import { compilerFlagsFor } from "../content/problems";
import { ResultsPanel } from "../judge/ResultsPanel";
import { useJudge } from "../judge/useJudge";
import { setCode } from "../save/progress";
import { useSave } from "../save/SaveProvider";

const CodeEditor = lazy(() => import("../components/CodeEditor").then((m) => ({ default: m.CodeEditor })));

type Props = { drill: JudgedDrill; isLocked: boolean; onResult: (correct: boolean) => void };

/** Fix-the-bug and mini-write drills: judged like a boss. His code is kept in the save (P8). */
export function JudgedInput({ drill, isLocked, onResult }: Props) {
  const { save, update } = useSave();
  const judge = useJudge();
  const code = save.code[drill.id] ?? drill.code;

  const check = async () => {
    const report = await judge.submit(code, drill.tests, compilerFlagsFor(drill));
    if (!report) return; // judge unreachable: no verdict, nothing recorded
    onResult(report.kind === "graded" && report.passed === report.total);
  };

  return (
    <div className="drill-body">
      <Suspense fallback={<div className="editor-loading">Loading editor…</div>}>
        <CodeEditor value={code} onChange={(source) => update((s) => setCode(s, drill.id, source, new Date()))} label={`Code for drill ${drill.id}`} />
      </Suspense>
      <button className="btn btn-primary" type="button" disabled={isLocked || judge.isBusy || code.trim() === ""} onClick={check}>
        Check (runs the tests)
      </button>
      <ResultsPanel state={judge.state} />
    </div>
  );
}
