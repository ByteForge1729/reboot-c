import { SaveSchema, type Save } from "./schema";
import { currentMissionId, restoredCount } from "./progress";

export type ImportResult = { ok: true; save: Save } | { ok: false; error: string };

export function exportFileName(now: Date): string {
  return `reboot-save-${now.toISOString().slice(0, 10)}.json`;
}

export function serializeSave(save: Save): string {
  return JSON.stringify(save, null, 2);
}

export function parseImport(text: string): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not a save file (it isn't valid JSON)." };
  }
  const parsed = SaveSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: "That file doesn't look like a REBOOT save. Your current progress is unchanged." };
  }
  return { ok: true, save: parsed.data };
}

/** One-line summary used in the "replace your progress?" confirmation (invariant 4). */
export function describeProgress(save: Save): string {
  const restored = restoredCount(save);
  return `Mission ${currentMissionId(save)}, ${restored} system${restored === 1 ? "" : "s"} restored`;
}

export function markExported(save: Save, now: Date): Save {
  return { ...save, lastExportAt: now.toISOString() };
}
