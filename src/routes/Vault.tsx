import { RichText } from "../components/RichText";
import { contentFor } from "../content/lessons";
import { MISSIONS, systemCode } from "../content/missions";
import { useSave } from "../save/SaveProvider";

export function Vault() {
  const { save } = useSave();
  const isOpen = (id: number) => save.missions[String(id)]?.status === "restored";
  const anyOpen = MISSIONS.some((m) => isOpen(m.id));

  return (
    <section aria-labelledby="vault-title">
      <p className="eyebrow">Cheat-sheet vault</p>
      <h1 id="vault-title">System manuals</h1>
      {!anyOpen && <p className="lede">Restore a system to unlock its manual.</p>}
      <div className="vault-grid">
        {MISSIONS.map((m) => {
          const open = isOpen(m.id);
          const sheet = contentFor(m.id)?.cheatsheet;
          return (
            <article key={m.id} className={`manual ${open ? "" : "locked"} ${open && sheet ? "manual-open" : ""}`}>
              <div className="node-id">{systemCode(m.id)}</div>
              <div className="node-name manual-name">{m.system}</div>
              <div className="node-topic">{open ? m.topic : "Locked"}</div>
              {open && sheet && (
                <div className="manual-sheet">
                  <RichText text={sheet} />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
