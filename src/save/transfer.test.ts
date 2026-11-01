import { describe, expect, test } from "vitest";
import { createFreshSave } from "./schema";
import { describeProgress, exportFileName, markExported, parseImport, serializeSave } from "./transfer";

const NOW = new Date("2026-11-01T10:00:00Z");

describe("exportFileName", () => {
  test("uses the date in the file name", () => {
    expect(exportFileName(NOW)).toBe("reboot-save-2026-11-01.json");
  });
});

describe("parseImport (invariant 4)", () => {
  test("accepts a file produced by export", () => {
    const save = { ...createFreshSave(NOW), code: { x: "int a;" } };

    const result = parseImport(serializeSave(save));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save.code.x).toBe("int a;");
  });

  test("rejects text that is not JSON, with a reason", () => {
    const result = parseImport("hello");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not a save file/i);
  });

  test("rejects JSON that is not a REBOOT save, with a reason", () => {
    const result = parseImport(JSON.stringify({ version: 1, missions: "nope" }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/doesn't look like a REBOOT save/i);
  });
});

describe("describeProgress", () => {
  test("names the current mission for the import confirmation", () => {
    expect(describeProgress(createFreshSave(NOW))).toBe("Mission 0, 0 systems restored");
  });
});

describe("markExported", () => {
  test("records the export time without mutating the original", () => {
    const original = createFreshSave(NOW);

    const updated = markExported(original, NOW);

    expect(updated.lastExportAt).toBe(NOW.toISOString());
    expect(original.lastExportAt).toBeNull();
  });
});
