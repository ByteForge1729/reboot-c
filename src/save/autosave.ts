import type { Save } from "./schema";

export const AUTOSAVE_DELAY_MS = 1000;

export interface Autosaver {
  schedule(save: Save): void;
  flush(): void;
}

/** Debounced writer: saves 1 s after the last change, or immediately on flush (invariant 1). */
export function createAutosaver(write: (save: Save) => void, delayMs = AUTOSAVE_DELAY_MS): Autosaver {
  let pending: Save | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (pending === null) return;
    const toWrite = pending;
    pending = null;
    write(toWrite);
  };

  return {
    schedule(save) {
      pending = save;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
  };
}
