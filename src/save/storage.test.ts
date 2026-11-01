import { describe, expect, test } from "vitest";
import { createFreshSave } from "./schema";
import { CORRUPT_BACKUP_KEY, STORAGE_KEY, readSave, writeSave, type KeyValueStore } from "./storage";

const NOW = new Date("2026-11-01T10:00:00Z");

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const throwingStore: KeyValueStore = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("readSave", () => {
  test("returns a fresh save when nothing is stored", () => {
    const result = readSave(memoryStore(), NOW);

    expect(result.status).toBe("fresh");
    expect(result.save.missions["0"].status).toBe("active");
  });

  test("round-trips a written save", () => {
    const store = memoryStore();
    const save = { ...createFreshSave(NOW), code: { "m0-b1": "int main(void){}" } };

    writeSave(store, save);
    const result = readSave(store, NOW);

    expect(result.status).toBe("stored");
    expect(result.save.code["m0-b1"]).toBe("int main(void){}");
  });

  test("keeps a backup of unreadable data instead of silently dropping it (P8)", () => {
    const store = memoryStore({ [STORAGE_KEY]: "{not json" });

    const result = readSave(store, NOW);

    expect(result.status).toBe("corrupt");
    expect(store.data[CORRUPT_BACKUP_KEY]).toBe("{not json");
  });

  test("reports storage as unavailable when reading throws", () => {
    const result = readSave(throwingStore, NOW);

    expect(result.status).toBe("unavailable");
    expect(result.save.missions["0"].status).toBe("active");
  });
});

describe("writeSave", () => {
  test("reports failure instead of throwing when storage is full or blocked (invariant 8)", () => {
    const result = writeSave(throwingStore, createFreshSave(NOW));

    expect(result.ok).toBe(false);
  });

  test("reports success on a working store", () => {
    expect(writeSave(memoryStore(), createFreshSave(NOW)).ok).toBe(true);
  });
});
