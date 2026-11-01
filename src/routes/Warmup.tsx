import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SigmaLine } from "../components/SigmaLine";
import { drillById, warmupPoolBefore } from "../content/lessons";
import { missionById, systemCode } from "../content/missions";
import { DrillCard } from "../drills/DrillCard";
import { WARMUP_SIZE, pickWarmup } from "../drills/warmup";
import { localDateKey, markWarmupShown } from "../save/progress";
import { useSave } from "../save/SaveProvider";

/** Only in-app mission paths are allowed as the destination. */
function safeNext(raw: string | null, missionId: number): string {
  return raw && raw.startsWith(`/mission/${missionId}`) ? raw : `/mission/${missionId}`;
}

export function Warmup() {
  const { save, update } = useSave();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const missionId = Number(useParams().missionId);
  const next = safeNext(search.get("next"), missionId);
  const progress = save.missions[String(missionId)];
  const [ids] = useState(() => {
    const lastWrong = new Set(Object.entries(save.drills).filter(([, d]) => !d.correct).map(([id]) => id));
    return pickWarmup(warmupPoolBefore(missionId).map((d) => d.id), lastWrong, WARMUP_SIZE, Math.random);
  });
  const [completed, setCompleted] = useState<ReadonlySet<string>>(new Set());

  const leave = () => {
    update((s) => markWarmupShown(s, missionId, localDateKey(new Date())));
    navigate(next, { replace: true });
  };

  // Nothing earlier to practise: go straight on. `ids` is fixed at mount, so this runs once.
  const isEmpty = ids.length === 0;
  useEffect(() => {
    if (isEmpty) leave();
  }, [isEmpty]); // `leave` is recreated each render; including it would re-run the redirect

  if (!missionById(missionId) || !progress || progress.status === "locked") return <Navigate to="/" replace />;

  const drills = ids.map(drillById).filter((d) => d !== undefined);
  const firstOpen = drills.findIndex((d) => !completed.has(d.id));
  const allDone = drills.length > 0 && firstOpen === -1;

  return (
    <section aria-labelledby="warmup-title">
      <p className="crumb">
        <Link to={`/mission/${missionId}`}>{systemCode(missionId)} · {missionById(missionId)?.system}</Link> / Warm-up
      </p>
      <div className="lesson-head">
        <h1 id="warmup-title">Warm-up</h1>
        <button className="btn" type="button" onClick={leave}>Skip warm-up</button>
      </div>
      <p className="lede">{drills.length} quick ones from earlier systems. Things you got wrong come back more often.</p>
      <div className="drill-stack">
        {drills.slice(0, allDone ? drills.length : firstOpen + 1).map((drill) => (
          <DrillCard key={drill.id} drill={drill} onComplete={() => setCompleted((prev) => new Set(prev).add(drill.id))} />
        ))}
      </div>
      {allDone && (
        <div className="lesson-done">
          <SigmaLine text="Warmed up. Your neurons are now at operating temperature." />
          <button className="btn btn-primary" type="button" onClick={leave}>Continue ▸</button>
        </div>
      )}
    </section>
  );
}
