import { describe, expect, test } from "vitest";
import { MISSION_COUNT, SaveSchema, createFreshSave } from "./schema";

const NOW = new Date("2026-11-01T10:00:00Z");

describe("createFreshSave", () => {
  test("makes mission 0 active and every other mission locked (invariant 3)", () => {
    const save = createFreshSave(NOW);

    expect(save.missions["0"].status).toBe("active");
    const locked = Object.entries(save.missions).filter(([id]) => id !== "0");
    expect(locked).toHaveLength(MISSION_COUNT - 1);
    expect(locked.every(([, m]) => m.status === "locked")).toBe(true);
  });

  test("loads saves written before warm-ups existed, defaulting the new field", () => {
    const { warmups: _omitted, ...older } = createFreshSave(NOW);

    const parsed = SaveSchema.safeParse(older);

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.warmups).toEqual({});
  });

  test("produces a save that passes its own schema", () => {
    const save = createFreshSave(NOW);

    expect(SaveSchema.safeParse(save).success).toBe(true);
    expect(save.createdAt).toBe("2026-11-01T10:00:00.000Z");
    expect(save.lastExportAt).toBeNull();
  });
});
