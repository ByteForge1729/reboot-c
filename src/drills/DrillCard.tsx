import { useRef, useState } from "react";
import { InlineCode, RichText } from "../components/RichText";
import type { Drill } from "../content/lessons";
import { recordDrillAttempt } from "../save/progress";
import { useSave } from "../save/SaveProvider";
import { splitFill } from "./check";
import { FillInput } from "./FillInput";
import { JudgedInput } from "./JudgedInput";
import { ParsonsInput } from "./ParsonsInput";
import { PredictInput } from "./PredictInput";

type Status = "answering" | "correct" | "wrong" | "revealed";

type Props = {
  drill: Drill;
  /** Checkpoints: one attempt, then the explanation (no retry, no reveal). */
  isSingleAttempt?: boolean;
  showPredictCode?: boolean;
  /** Called exactly once, when the drill is finished: right, or revealed / failed. */
  onComplete: (correct: boolean) => void;
};

const KIND_LABEL: Record<Drill["kind"], string> = {
  predict: "Predict the output",
  fill: "Fill the blank",
  parsons: "Put it in order",
  fix: "Fix the bug",
  write: "Write it",
};

function Answer({ drill }: { drill: Drill }) {
  switch (drill.kind) {
    case "predict":
      return <pre className="drill-code">{drill.answer.replace(/\n$/, "")}</pre>;
    case "fill":
      return <pre className="drill-code">{splitFill(drill.code).map((s, i) => s + (drill.blanks[i]?.[0] ?? "")).join("")}</pre>;
    case "parsons":
      return <pre className="drill-code">{drill.lines.map((l) => "    ".repeat(l.indent) + l.text).join("\n")}</pre>;
    case "fix":
    case "write":
      return <pre className="drill-code">{drill.solution}</pre>;
  }
}

export function DrillCard({ drill, isSingleAttempt = false, showPredictCode = true, onComplete }: Props) {
  const { update } = useSave();
  const [status, setStatus] = useState<Status>("answering");
  const completed = useRef(false);

  const finish = (correct: boolean) => {
    if (completed.current) return;
    completed.current = true;
    onComplete(correct);
  };
  const handleResult = (correct: boolean) => {
    update((s) => recordDrillAttempt(s, drill.id, correct, new Date()));
    setStatus(correct ? "correct" : "wrong");
    if (correct || isSingleAttempt) finish(correct);
  };
  const reveal = () => {
    setStatus("revealed");
    finish(false);
  };

  const isLocked = status !== "answering";
  const body = (() => {
    switch (drill.kind) {
      case "predict":
        return <PredictInput drill={drill} isLocked={isLocked} showCode={showPredictCode} onResult={handleResult} />;
      case "fill":
        return <FillInput drill={drill} isLocked={isLocked} onResult={handleResult} />;
      case "parsons":
        return <ParsonsInput drill={drill} isLocked={isLocked} onResult={handleResult} />;
      case "fix":
      case "write":
        return <JudgedInput drill={drill} isLocked={isLocked} onResult={handleResult} />;
    }
  })();

  return (
    <article className={`drill drill-${status}`} aria-label={KIND_LABEL[drill.kind]}>
      <p className="eyebrow">{KIND_LABEL[drill.kind]}</p>
      <div className="drill-prompt">
        <RichText text={drill.prompt} />
      </div>
      {body}

      {status === "correct" && (
        <div className="feedback feedback-ok" role="status">
          <strong>✔ Right.</strong> <InlineCode text={drill.explain} />
        </div>
      )}
      {status === "wrong" && isSingleAttempt && (
        <div className="feedback feedback-bad" role="status">
          <strong>✘ Not this time.</strong> <InlineCode text={drill.explain} />
          <Answer drill={drill} />
        </div>
      )}
      {status === "wrong" && !isSingleAttempt && (
        <div className="feedback feedback-bad" role="status">
          <strong>✘ Not quite.</strong>
          <div className="feedback-actions">
            <button className="btn" type="button" onClick={() => setStatus("answering")}>Try again</button>
            <button className="btn" type="button" onClick={reveal}>Show me why</button>
          </div>
        </div>
      )}
      {status === "revealed" && (
        <div className="feedback feedback-reveal" role="status">
          <strong>Here's the answer.</strong> <InlineCode text={drill.explain} />
          <Answer drill={drill} />
        </div>
      )}
    </article>
  );
}
