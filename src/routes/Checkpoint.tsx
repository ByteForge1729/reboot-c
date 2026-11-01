import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { SigmaLine } from "../components/SigmaLine";
import { contentFor, type MissionContent } from "../content/lessons";
import { missionById, systemCode } from "../content/missions";
import { DrillCard } from "../drills/DrillCard";
import { seededShuffle } from "../drills/shuffle";
import { CHECKPOINT_PASS, applyAndRestore, recordCheckpoint } from "../save/progress";
import { useSave } from "../save/SaveProvider";

type RoundProps = { missionId: number; content: MissionContent; round: number; onRetry: () => void };

/** One checkpoint attempt: 5 drills, one try each, in an order that changes every round. */
function CheckpointRound({ missionId, content, round, onRetry }: RoundProps) {
  const { update } = useSave();
  const navigate = useNavigate();
  const [drills] = useState(() => seededShuffle(content.checkpoint, `m${missionId}-checkpoint-${round}`));
  const [results, setResults] = useState<ReadonlyMap<string, boolean>>(new Map());
  const firstOpen = drills.findIndex((d) => !results.has(d.id));
  const finished = firstOpen === -1;
  const score = [...results.values()].filter(Boolean).length;
  const passed = score >= CHECKPOINT_PASS;

  const handleComplete = (drillId: string, correct: boolean) => {
    const next = new Map(results).set(drillId, correct);
    setResults(next);
    if (next.size < drills.length) return;
    const finalScore = [...next.values()].filter(Boolean).length;
    let restored = false;
    update((s) => {
      const lessonIds = content.lessons.map((l) => l.id);
      const result = applyAndRestore(s, (x) => recordCheckpoint(x, missionId, finalScore, new Date()), missionId, lessonIds, new Date());
      restored = result.restored;
      return result.save;
    });
    if (restored) navigate("/map", { state: { justRestored: missionId } });
  };

  return (
    <>
      <div className="drill-stack">
        {drills.slice(0, finished ? drills.length : firstOpen + 1).map((drill) => (
          <DrillCard key={drill.id} drill={drill} isSingleAttempt onComplete={(correct) => handleComplete(drill.id, correct)} />
        ))}
      </div>
      {finished && (
        <div className="lesson-done">
          <p className={`result-score ${passed ? "" : "partial"}`}>
            {score} / {drills.length}
          </p>
          <SigmaLine
            text={passed ? "Checkpoint cleared. The bosses are awake. So are you, I hope." : `${score} out of ${drills.length}. You need ${CHECKPOINT_PASS}. Same questions, new order. Again?`}
          />
          <div className="settings-row">
            {passed ? (
              <Link className="btn btn-primary" to={`/mission/${missionId}/boss/1`}>Face boss 1 ▸</Link>
            ) : (
              <button className="btn btn-primary" type="button" onClick={onRetry}>Retry</button>
            )}
            <Link className="btn" to={`/mission/${missionId}`}>Mission overview</Link>
          </div>
        </div>
      )}
    </>
  );
}

export function Checkpoint() {
  const { save } = useSave();
  const [round, setRound] = useState(0);
  const missionId = Number(useParams().missionId);
  const progress = save.missions[String(missionId)];
  const content = contentFor(missionId);

  if (!missionById(missionId) || !progress || progress.status === "locked" || !content) return <Navigate to="/" replace />;
  const lessonsLeft = content.lessons.filter((l) => !progress.lessonsDone.includes(l.id));

  return (
    <section aria-labelledby="checkpoint-title">
      <p className="crumb">
        <Link to={`/mission/${missionId}`}>{systemCode(missionId)} · {missionById(missionId)?.system}</Link> / Checkpoint
      </p>
      <h1 id="checkpoint-title">Checkpoint</h1>
      {lessonsLeft.length > 0 ? (
        <div className="placeholder">Finish the lessons first ({lessonsLeft.length} to go).</div>
      ) : (
        <>
          <p className="lede">
            5 questions, one try each. {CHECKPOINT_PASS} right unlocks the bosses. Best so far: {progress.checkpointBest} / 5.
          </p>
          <CheckpointRound key={round} missionId={missionId} content={content} round={round} onRetry={() => setRound((r) => r + 1)} />
        </>
      )}
    </section>
  );
}
