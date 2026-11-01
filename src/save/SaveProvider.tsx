import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createAutosaver } from "./autosave";
import type { Save } from "./schema";
import { browserStore, readSave, writeSave, type ReadStatus } from "./storage";

interface SaveContextValue {
  save: Save;
  readStatus: ReadStatus;
  /** False once any write has failed (quota, private mode); drives the banner (invariant 8). */
  storageOk: boolean;
  /** Apply an immutable change; persisted 1 s later (invariant 1). */
  update: (change: (save: Save) => Save) => void;
  /** Replace the whole save and write it immediately (import, reset). */
  replace: (save: Save) => void;
  flush: () => void;
}

const SaveContext = createContext<SaveContextValue | null>(null);

export function SaveProvider({ children }: { children: ReactNode }) {
  const store = useMemo(browserStore, []);
  const initial = useMemo(() => readSave(store, new Date()), [store]);
  const [save, setSave] = useState<Save>(initial.save);
  const [storageOk, setStorageOk] = useState(initial.status !== "unavailable");
  const saveRef = useRef(save);

  const persist = useCallback(
    (next: Save) => {
      const result = writeSave(store, next);
      setStorageOk(result.ok);
    },
    [store],
  );
  const autosaver = useMemo(() => createAutosaver(persist), [persist]);

  const update = useCallback(
    (change: (save: Save) => Save) => {
      const next = change(saveRef.current);
      if (next === saveRef.current) return;
      saveRef.current = next;
      setSave(next);
      autosaver.schedule(next);
    },
    [autosaver],
  );

  const replace = useCallback(
    (next: Save) => {
      saveRef.current = next;
      setSave(next);
      autosaver.schedule(next);
      autosaver.flush();
    },
    [autosaver],
  );

  // Write anything pending before the tab hides or closes (invariant 1).
  useEffect(() => {
    const onHide = () => autosaver.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") autosaver.flush();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      autosaver.flush();
    };
  }, [autosaver]);

  const value = useMemo<SaveContextValue>(
    () => ({ save, readStatus: initial.status, storageOk, update, replace, flush: autosaver.flush }),
    [save, initial.status, storageOk, update, replace, autosaver],
  );

  return <SaveContext.Provider value={value}>{children}</SaveContext.Provider>;
}

export function useSave(): SaveContextValue {
  const ctx = useContext(SaveContext);
  if (!ctx) throw new Error("useSave must be used inside <SaveProvider>");
  return ctx;
}
