import { Suspense, lazy, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { BossHints } from "../components/BossHints";
import { RichText } from "../components/RichText";
import { SigmaLine } from "../components/SigmaLine";
import { contentFor } from "../content/lessons";
import { missionById, systemCode } from "../content/missions";
import { compilerFlagsFor, problemById } from "../content/problems";
import { ResultsPanel } from "../judge/ResultsPanel";
import { useJudge } from "../judge/useJudge";
import { CHECKPOINT_PASS, applyAndRestore, recordSubmission, setCode } from "../save/progress";
import { useSave } from "../save/SaveProvider";

// The editor is the heaviest dependency; load it only when a boss opens.
const CodeEditor = lazy(() => import("../components/CodeEditor").then((m) => ({ default: m.CodeEditor })));

const FALLBACK_STARTER = `#include <stdio.h>

int main(void) {
    // your code here
    return 0;
}
`;
const DIFFICULTY = ["Easy", "Medium", "Hard"];

export function Boss() {
  const { save, update } = useSave();
  const judge = useJudge();
  const [stdin, setStdin] = useState("");
  const [justRestored, setJustRestored] = useState(false);
  const params = useParams();
  const missionId = Number(params.missionId);
  const bossNumber = Number(params.bossNumber);
  const mission = missionById(missionId);
  const progress = save.missions[String(missionId)];
  const problemId = `m${missionId}-b${bossNumber}`;
  const problem = problemById(problemId);

  if (!mission || !progress || progress.status === "locked") return <Navigate to="/" replace />;

  const content = contentFor(missionId);
  if (content && progress.checkpointBest < CHECKPOINT_PASS) {
    return (
      <section aria-labelledby="boss-title">
        <p className="crumb">
          <Link to={`/mission/${missionId}`}>{systemCode(missionId)} · {mission.system}</Link> / Boss {bossNumber}
        </p>
        <h1 id="boss-title">{problem?.title ?? `Boss ${bossNumber}`}</h1>
        <div className="placeholder">This boss is still asleep. Pass the checkpoint ({CHECKPOINT_PASS} of 5) to wake it up.</div>
        <Link className="btn btn-primary" to={`/mission/${missionId}`}>Back to the mission</Link>
      </section>
    );
  }
  const lessonIds = content?.lessons.map((l) => l.id) ?? [];

  const code = save.code[problemId] ?? problem?.starter ?? FALLBACK_STARTER;
  const flags = compilerFlagsFor(problem);
  const isEmpty = code.trim() === "";
  const solved = progress.bossesSolved.includes(problemId);
  const attempt = save.bossAttempts[problemId];
  const justSolved = judge.state.phase === "submitted" && judge.state.report.kind === "graded" && judge.state.report.passed === judge.state.report.total;

  const handleChange = (source: string) => update((s) => setCode(s, problemId, source, new Date()));
  const examples = problem?.tests.filter((t) => t.visible) ?? [];
  // File bosses (M9): a manual run gets the first example's files so fopen has something to open.
  const runFiles = examples.find((t) => t.files)?.files;
  const handleRun = () => judge.run(code, stdin, flags, runFiles);
  const handleSubmit = async () => {
    if (!problem) return;
    const report = await judge.submit(code, problem.tests, flags);
    if (!report) return; // judge not reached: the submit doesn't count (rule 10)
    const passed = report.kind === "graded" ? report.passed : 0;
    let restored = false;
    update((s) => {
      const record = (x: typeof s) => recordSubmission(x, missionId, problemId, passed, problem.tests.length, new Date());
      const result = applyAndRestore(s, record, missionId, lessonIds, new Date());
      restored = result.restored;
      return result.save;
    });
    if (restored) setJustRestored(true);
  };

  return (
    <section aria-labelledby="boss-title">
      <p className="crumb">
        <Link to={`/mission/${missionId}`}>{systemCode(missionId)} · {mission.system}</Link> / Boss {bossNumber}
      </p>
      <p className="eyebrow">
        Boss {bossNumber} · {DIFFICULTY[bossNumber - 1] ?? ""}
        {solved && <span className="solved-tag"> · SOLVED</span>}
        {attempt && !solved && <span> · best {attempt.best}</span>}
      </p>
      <h1 id="boss-title">{problem?.title ?? `Boss ${bossNumber}`}</h1>
      <p className="laptop-note">Boss fights work best on a laptop.</p>

      <div className="boss-grid">
        <div className="panel problem-panel">
          {problem ? (
            <>
              <RichText text={problem.story} />
              {examples.length > 0 && (
                <div className="examples">
                  <p className="eyebrow">Examples</p>
                  {examples.map((t, i) => (
                    <div className="example" key={i}>
                      {Object.entries(t.files ?? {}).map(([name, text]) => (
                        <div key={name}>
                          <span className="example-label">file {name}</span>
                          <pre className="result-pre">{text === "" ? "(empty file)" : text.replace(/\n$/, "")}</pre>
                        </div>
                      ))}
                      {t.stdin && (
                        <div>
                          <span className="example-label">input</span>
                          <pre className="result-pre">{t.stdin.replace(/\n$/, "")}</pre>
                        </div>
                      )}
                      <div>
                        <span className="example-label">output</span>
                        <pre className="result-pre">{t.expected.replace(/\n$/, "")}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <BossHints problemId={problemId} hints={problem.hints} solution={problem.solution} />
            </>
          ) : (
            <div className="placeholder" style={{ margin: 0 }}>
              This boss hasn't been written yet. You can still write and run C here.
            </div>
          )}
        </div>

        <div className="panel">
          <p className="eyebrow">main.c</p>
          <Suspense fallback={<div className="editor-loading">Loading editor…</div>}>
            <CodeEditor value={code} onChange={handleChange} label={`Code for ${problem?.title ?? `boss ${bossNumber}`}`} />
          </Suspense>
          <details className="custom-input">
            <summary>Custom input for Run</summary>
            <textarea
              className="editor stdin-box"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Typed here, read by scanf"
              spellCheck={false}
              aria-label="Custom input for Run"
            />
          </details>
          <div className="editor-bar">
            <span className="saved-note">Autosaves as you type</span>
            <span className="editor-actions">
              <button className="btn" onClick={handleRun} disabled={judge.isBusy || isEmpty} title={isEmpty ? "Write something first." : undefined}>
                Run
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={judge.isBusy || isEmpty || !problem}
                title={isEmpty ? "Write something first." : undefined}
              >
                Submit
              </button>
            </span>
          </div>
          <div className="results" aria-live="polite">
            <ResultsPanel state={judge.state} />
            {justSolved && (
              <SigmaLine text={`${problem?.tests.length}/${problem?.tests.length}. ${mission.system} is humming. I'd hug you if I had arms.`} />
            )}
            {justRestored && (
              <Link className="btn btn-primary restore-cta" to="/map" state={{ justRestored: missionId }}>
                {mission.system} restored. See the station ▸
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
