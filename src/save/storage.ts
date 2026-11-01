import { SaveSchema, createFreshSave, type Save } from "./schema";

export const STORAGE_KEY = "reboot.save.v1";
export const CORRUPT_BACKUP_KEY = "reboot.save.v1.corrupt";

/** The subset of the Web Storage API we use, so tests can pass an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ReadStatus = "fresh" | "stored" | "corrupt" | "unavailable";

export interface ReadResult {
  save: Save;
  status: ReadStatus;
}

export type WriteResult = { ok: true } | { ok: false; reason: string };

function parseStored(raw: string): Save | null {
  try {
    const parsed = SaveSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readSave(store: KeyValueStore, now: Date): ReadResult {
  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return { save: createFreshSave(now), status: "unavailable" };
  }
  if (raw === null) return { save: createFreshSave(now), status: "fresh" };

  const save = parseStored(raw);
  if (save) return { save, status: "stored" };

  // Never drop unreadable progress silently (P8): keep the raw text for recovery.
  try {
    store.setItem(CORRUPT_BACKUP_KEY, raw);
  } catch {
    return { save: createFreshSave(now), status: "unavailable" };
  }
  return { save: createFreshSave(now), status: "corrupt" };
}

export function writeSave(store: KeyValueStore, save: Save): WriteResult {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(save));
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, reason: error instanceof Error ? error.message : "Storage write failed" };
  }
}

/** localStorage can throw on access itself (private mode, blocked site data). */
export function browserStore(): KeyValueStore {
  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  };
}
