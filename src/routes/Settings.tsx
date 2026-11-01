import { useRef, useState, type ChangeEvent } from "react";
import { createFreshSave, type Save } from "../save/schema";
import { describeProgress, exportFileName, markExported, parseImport, serializeSave } from "../save/transfer";
import { useSave } from "../save/SaveProvider";

type Notice = { tone: "ok" | "error"; text: string } | null;
const RESET_WORD = "RESET";

function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function Settings() {
  const { save, update, replace } = useSave();
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingImport, setPendingImport] = useState<Save | null>(null);
  const [resetText, setResetText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const exportSave = () => {
    const now = new Date();
    const exported = markExported(save, now);
    downloadText(exportFileName(now), serializeSave(exported));
    update(() => exported);
    setNotice({ tone: "ok", text: "Save exported. Keep the file somewhere safe." });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const result = parseImport(await file.text());
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      setNotice(null);
      setPendingImport(result.save);
    } catch {
      setNotice({ tone: "error", text: "That file couldn't be read. Your current progress is unchanged." });
    }
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    replace(pendingImport);
    setPendingImport(null);
    setNotice({ tone: "ok", text: "Save imported." });
  };

  const confirmReset = () => {
    replace(createFreshSave(new Date()));
    setResetText("");
    setNotice({ tone: "ok", text: "Progress reset. The station is dark again." });
  };

  return (
    <section aria-labelledby="settings-title">
      <p className="eyebrow">Settings</p>
      <h1 id="settings-title">Station controls</h1>

      <div className="settings-section">
        <h2>Your save</h2>
        <p style={{ color: "var(--muted)" }}>
          Progress lives in this browser only: {describeProgress(save)}. Export a save file to move it to another
          laptop or keep a backup.
        </p>
        <div className="settings-row">
          <button className="btn btn-primary" onClick={exportSave}>Export save file</button>
          <button className="btn" onClick={() => fileInput.current?.click()}>Import save file…</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onFile} />
        </div>
        {pendingImport && (
          <div className="confirm" role="alertdialog" aria-label="Confirm import">
            <p>
              This will replace your current progress (<strong>{describeProgress(save)}</strong>) with the file's
              progress (<strong>{describeProgress(pendingImport)}</strong>).
            </p>
            <div className="settings-row">
              <button className="btn btn-primary" onClick={confirmImport}>Replace my progress</button>
              <button className="btn" onClick={() => setPendingImport(null)}>Cancel</button>
            </div>
          </div>
        )}
        {notice && <p className={`notice ${notice.tone}`} role="status">{notice.text}</p>}
      </div>

      <div className="settings-section">
        <h2>Comfort</h2>
        <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start" }}>
          <label className="field-label">
            <input
              type="checkbox"
              checked={save.settings.reducedMotion}
              onChange={(e) => {
                const reducedMotion = e.target.checked;
                update((s) => ({ ...s, settings: { ...s.settings, reducedMotion } }));
              }}
            />
            Reduce motion (no typing effect or animations)
          </label>
          <label className="field-label">
            <input
              type="checkbox"
              checked={save.settings.fontSize === "large"}
              onChange={(e) => {
                const fontSize = e.target.checked ? "large" : "normal";
                update((s) => ({ ...s, settings: { ...s.settings, fontSize } }));
              }}
            />
            Larger text
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h2>Reset</h2>
        <p style={{ color: "var(--muted)" }}>Wipes all progress and code in this browser. Type {RESET_WORD} to confirm.</p>
        <div className="settings-row">
          <input
            className="text-input"
            value={resetText}
            onChange={(e) => setResetText(e.target.value)}
            aria-label={`Type ${RESET_WORD} to confirm`}
            placeholder={RESET_WORD}
          />
          <button className="btn btn-danger" disabled={resetText !== RESET_WORD} onClick={confirmReset}>
            Reset progress
          </button>
        </div>
      </div>
    </section>
  );
}
