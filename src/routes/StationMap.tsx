import type { CSSProperties } from "react";
import { Link, useLocation } from "react-router-dom";
import { SigmaLine } from "../components/SigmaLine";
import { MISSIONS, missionById, systemCode } from "../content/missions";
import { stationPower } from "../save/progress";
import { useSave } from "../save/SaveProvider";
import type { MissionStatus } from "../save/schema";

const STATUS_LABEL: Record<MissionStatus, string> = {
  locked: "LOCKED",
  active: "ACTIVE",
  restored: "RESTORED",
};
const BOSSES_PER_MISSION = 3;

function Stars({ count }: { count: number }) {
  return (
    <span className="stars" aria-label={`${count} of ${BOSSES_PER_MISSION} bosses solved`}>
      {Array.from({ length: BOSSES_PER_MISSION }, (_, i) => (
        <span key={i} className={i < count ? "" : "off"}>★</span>
      ))}
    </span>
  );
}

export function StationMap() {
  const { save } = useSave();
  const power = stationPower(save);
  const restoredState = useLocation().state as { justRestored?: number } | null;
  const justRestored = typeof restoredState?.justRestored === "number" ? restoredState.justRestored : null;
  const restoredSystem = justRestored !== null ? missionById(justRestored)?.system : undefined;

  return (
    <section aria-labelledby="map-title">
      <div className="map-head">
        <div>
          <p className="eyebrow">Orbital station KERNEL-7</p>
          <h1 id="map-title">Station map</h1>
        </div>
        <div className="power" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={power} aria-label="Station power">
          <div className="power-label">
            <span>STATION POWER</span>
            <strong>{power}%</strong>
          </div>
          <div className="power-track">
            <div className="power-fill" style={{ transform: `scaleX(${power / 100})` }} />
          </div>
        </div>
      </div>

      {restoredSystem && <SigmaLine text={`${restoredSystem} restored. Station power at ${power}%. Next system is waking up.`} />}

      <ol className="station" style={{ "--conduit": `${power}%`, listStyle: "none", padding: 0, margin: 0 } as CSSProperties}>
        {MISSIONS.map((m) => {
          const progress = save.missions[String(m.id)];
          const status = progress?.status ?? "locked";
          const content = (
            <>
              <div className="node-id">{systemCode(m.id)}</div>
              <div className="node-name">{m.system}</div>
              <div className="node-topic">{m.topic}</div>
              <div className="node-foot">
                <span className="node-status">{STATUS_LABEL[status]}</span>
                <Stars count={progress?.bossesSolved.length ?? 0} />
              </div>
            </>
          );
          return (
            <li key={m.id} style={{ display: "contents" }}>
              {status === "locked" ? (
                <div className={`node ${status}`} aria-disabled="true">{content}</div>
              ) : (
                <Link className={`node ${status} ${m.id === justRestored ? "just-restored" : ""}`} to={`/mission/${m.id}`}>{content}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
