import { Fragment, useState } from "react";
import type { FillDrill } from "../content/lessons";
import { checkFill, splitFill } from "./check";

type Props = { drill: FillDrill; isLocked: boolean; onResult: (correct: boolean) => void };

const MIN_BLANK_CHARS = 3;

export function FillInput({ drill, isLocked, onResult }: Props) {
  const segments = splitFill(drill.code);
  const [responses, setResponses] = useState<string[]>(() => drill.blanks.map(() => ""));
  const canCheck = !isLocked && responses.every((r) => r.trim() !== "");

  const setBlank = (index: number, value: string) => setResponses((prev) => prev.map((r, i) => (i === index ? value : r)));

  return (
    <div className="drill-body">
      <pre className="drill-code fill-code">
        {segments.map((segment, i) => (
          <Fragment key={i}>
            {segment}
            {i < drill.blanks.length && (
              <input
                className="blank"
                value={responses[i]}
                disabled={isLocked}
                onChange={(e) => setBlank(i, e.target.value)}
                size={Math.max(MIN_BLANK_CHARS, drill.blanks[i][0].length + 1)}
                spellCheck={false}
                autoCapitalize="off"
                aria-label={`Blank ${i + 1}`}
              />
            )}
          </Fragment>
        ))}
      </pre>
      <button className="btn btn-primary" type="button" disabled={!canCheck} onClick={() => onResult(checkFill(drill.blanks, responses))}>
        Check
      </button>
    </div>
  );
}
