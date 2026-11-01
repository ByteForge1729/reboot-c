import { useMemo, useState } from "react";
import type { PredictDrill } from "../content/lessons";
import { checkPredict } from "./check";
import { seededShuffle } from "./shuffle";

type Props = {
  drill: PredictDrill;
  isLocked: boolean;
  /** Lesson predict drills sit right under the example, so they hide the duplicate code. */
  showCode?: boolean;
  onResult: (correct: boolean) => void;
};

export function PredictInput({ drill, isLocked, showCode = true, onResult }: Props) {
  const [response, setResponse] = useState("");
  const canCheck = !isLocked && response !== "";
  // Content lists the right answer first; show the options in a stable per-drill order instead.
  const options = useMemo(() => (drill.options ? seededShuffle(drill.options, drill.id) : null), [drill.options, drill.id]);

  return (
    <div className="drill-body">
      {showCode && <pre className="drill-code">{drill.code}</pre>}
      {options ? (
        <div className="choices" role="radiogroup" aria-label="Choose an answer">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={response === option}
              className={`choice ${response === option ? "chosen" : ""}`}
              disabled={isLocked}
              onClick={() => setResponse(option)}
            >
              <pre>{option}</pre>
            </button>
          ))}
        </div>
      ) : (
        <textarea
          className="editor answer-box"
          value={response}
          disabled={isLocked}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Type the output exactly, one line per line"
          spellCheck={false}
          aria-label="Your predicted output"
        />
      )}
      <button className="btn btn-primary" type="button" disabled={!canCheck} onClick={() => onResult(checkPredict(drill, response))}>
        Check
      </button>
    </div>
  );
}
