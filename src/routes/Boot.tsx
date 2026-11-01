import { Link } from "react-router-dom";
import { SigmaLine } from "../components/SigmaLine";
import { missionById } from "../content/missions";
import { currentMissionId, hasStarted } from "../save/progress";
import { useSave } from "../save/SaveProvider";

const BOOT_LOG: ReadonlyArray<[string, "ok" | "bad"]> = [
  ["kernel-7 ............ awake", "ok"],
  ["life support ........ OFFLINE", "bad"],
  ["engines ............. OFFLINE", "bad"],
  ["comms ............... OFFLINE", "bad"],
  ["c compiler .......... online", "ok"],
];

export function Boot() {
  const { save } = useSave();
  const returning = hasStarted(save);
  const missionId = currentMissionId(save);
  const mission = missionById(missionId);

  return (
    <section className="boot" aria-labelledby="boot-title">
      {returning ? (
        <pre className="boot-log">
          <span className="ok">kernel-7 awake.</span> welcome back, engineer.
        </pre>
      ) : (
        <pre className="boot-log">
          {BOOT_LOG.map(([line, tone]) => (
            <div key={line} className={tone}>{`> ${line}`}</div>
          ))}
        </pre>
      )}

      <h1 id="boot-title" className="boot-title">
        REBOOT<span>_</span>
      </h1>
      <p className="boot-sub">Bring a dead space station back online, one C program at a time.</p>

      <SigmaLine
        text={
          returning
            ? `Station power is holding. ${mission?.system ?? "The next system"} still needs you.`
            : "Oh good. A human. Life support is at 4%. No pressure. Well, actually, decreasing pressure. Can you type?"
        }
      />

      <div className="boot-actions">
        <Link className="btn btn-primary" to={`/mission/${missionId}`}>
          {returning ? `Continue: Mission ${missionId} · ${mission?.system}` : "Start ▸"}
        </Link>
        {returning && (
          <Link className="btn" to="/map">
            Station map
          </Link>
        )}
      </div>
    </section>
  );
}
