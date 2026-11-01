import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createFreshSave } from "./schema";
import { AUTOSAVE_DELAY_MS, createAutosaver } from "./autosave";

const NOW = new Date("2026-11-01T10:00:00Z");

describe("createAutosaver (invariant 1)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("writes once, 1 s after the last change", () => {
    const write = vi.fn();
    const saver = createAutosaver(write);
    const first = createFreshSave(NOW);
    const second = { ...first, code: { a: "x" } };

    saver.schedule(first);
    vi.advanceTimersByTime(500);
    saver.schedule(second);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    expect(write).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(second);
  });

  test("flush writes the pending save immediately (used when leaving the page)", () => {
    const write = vi.fn();
    const saver = createAutosaver(write);
    const save = createFreshSave(NOW);

    saver.schedule(save);
    saver.flush();

    expect(write).toHaveBeenCalledWith(save);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    expect(write).toHaveBeenCalledTimes(1);
  });

  test("flush with nothing pending does nothing", () => {
    const write = vi.fn();

    createAutosaver(write).flush();

    expect(write).not.toHaveBeenCalled();
  });
});
