import { Suspense, lazy, useState } from "react";
import { compilerFlagsFor } from "../content/problems";
import { ResultsPanel } from "../judge/ResultsPanel";
import { useJudge } from "../judge/useJudge";

const CodeEditor = lazy(() => import("./CodeEditor").then((m) => ({ default: m.CodeEditor })));

type Props = {
  source: string;
  stdin: string;
  /** Predict-before-run: Run stays locked until the predict drill is answered (lessons rule 2). */
  isRunLocked: boolean;
  label: string;
  /** Extra flags on top of the defaults, e.g. "-pthread" for Mission 13. */
  compileFlags?: string;
};

/** A lesson's example: editable for playing around, never saved. */
export function ExampleRunner({ source, stdin, isRunLocked, label, compileFlags }: Props) {
  const [code, setCode] = useState(source);
  const judge = useJudge();

  return (
    <div className="example-runner">
      <Suspense fallback={<div className="editor-loading">Loading editor…</div>}>
        <CodeEditor value={code} onChange={setCode} label={label} />
      </Suspense>
      <div className="editor-bar">
        <span className="saved-note">{isRunLocked ? "Guess what it prints first (below), then run it." : "Change it and run it again. Breaking it is allowed."}</span>
        <button
          className="btn btn-primary"
          type="button"
          disabled={isRunLocked || judge.isBusy}
          title={isRunLocked ? "Guess first." : undefined}
          onClick={() => judge.run(code, stdin, compilerFlagsFor({ compileFlags }))}
        >
          Run ▸
        </button>
      </div>
      <ResultsPanel state={judge.state} />
    </div>
  );
}
