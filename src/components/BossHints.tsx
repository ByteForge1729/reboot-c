import { canSeeSolution, openHint } from "../save/progress";
import { useSave } from "../save/SaveProvider";
import { InlineCode } from "./RichText";

type Props = { problemId: string; hints: readonly string[]; solution: string };

/** Three hints in order; the solution only after 3 submits and every hint (A16, invariant 7). */
export function BossHints({ problemId, hints, solution }: Props) {
  const { save, update } = useSave();
  const attempt = save.bossAttempts[problemId];
  const opened = attempt?.hintsOpened ?? 0;

  return (
    <div className="hints">
      <p className="eyebrow">Hints</p>
      {hints.slice(0, opened).map((hint, i) => (
        <p className="hint" key={i}>
          <span className="hint-num">{i + 1}</span> <InlineCode text={hint} />
        </p>
      ))}
      {opened < hints.length && (
        <button className="btn" type="button" onClick={() => update((s) => openHint(s, problemId, new Date()))}>
          Show hint {opened + 1}
        </button>
      )}
      {canSeeSolution(attempt) ? (
        <details className="solution">
          <summary>Show the solution</summary>
          <p className="drill-hint">Reading it doesn't count as solving. Type it in your own way and submit.</p>
          <pre className="result-pre">{solution}</pre>
        </details>
      ) : (
        opened === hints.length && <p className="drill-hint">The full solution unlocks after 3 submits.</p>
      )}
    </div>
  );
}
