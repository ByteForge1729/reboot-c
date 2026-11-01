import { describe, expect, test } from "vitest";
import { createFreshSave, type Save } from "./schema";
import {
  applyAndRestore,
  canSeeSolution,
  currentMissionId,
  hasStarted,
  markLessonDone,
  markWarmupShown,
  openHint,
  recordCheckpoint,
  recordDrillAttempt,
  recordSubmission,
  restoreIfComplete,
  setCode,
  stationPower,
  warmupDue,
} from "./progress";

const NOW = new Date("2026-11-01T10:00:00Z");

function withRestored(count: number): Save {
  const fresh = createFreshSave(NOW);
  const missions = Object.fromEntries(
    Object.entries(fresh.missions).map(([id, m]) => {
      const n = Number(id);
      const status = n < count ? "restored" : n === count ? "active" : "locked";
      return [id, { ...m, status }];
    }),
  ) as Save["missions"];
  return { ...fresh, missions };
}

describe("stationPower", () => {
  test.each([
    [0, 0],
    [1, 7],
    [3, 21],
    [7, 50],
    [14, 100],
  ])("with %i restored missions shows %i%%", (restored, expected) => {
    expect(stationPower(withRestored(restored))).toBe(expected);
  });
});

describe("currentMissionId", () => {
  test("is the active mission", () => {
    expect(currentMissionId(withRestored(3))).toBe(3);
  });

  test("is the last mission once everything is restored", () => {
    expect(currentMissionId(withRestored(14))).toBe(13);
  });
});

describe("markLessonDone", () => {
  test("adds the lesson once, without mutating the original", () => {
    const original = createFreshSave(NOW);

    const once = markLessonDone(original, 0, "m0-l1", NOW);
    const twice = markLessonDone(once, 0, "m0-l1", NOW);

    expect(twice.missions["0"].lessonsDone).toEqual(["m0-l1"]);
    expect(original.missions["0"].lessonsDone).toEqual([]);
  });
});

describe("hasStarted (map stays hidden until the first lesson is done)", () => {
  test("is false on a fresh save and true after one lesson", () => {
    const fresh = createFreshSave(NOW);

    expect(hasStarted(fresh)).toBe(false);
    expect(hasStarted(markLessonDone(fresh, 0, "m0-l1", NOW))).toBe(true);
  });
});

describe("recordSubmission (judge rule 10)", () => {
  test("counts the submit and keeps the best score", () => {
    const fresh = createFreshSave(NOW);

    const first = recordSubmission(fresh, 1, "m1-b1", 5, 8, NOW);
    const second = recordSubmission(first, 1, "m1-b1", 3, 8, NOW);

    expect(second.bossAttempts["m1-b1"]).toEqual({ submits: 2, hintsOpened: 0, best: "5/8" });
    expect(second.missions["1"].bossesSolved).toEqual([]);
    expect(fresh.bossAttempts["m1-b1"]).toBeUndefined();
  });

  test("marks the boss solved once, when every test passes", () => {
    const solved = recordSubmission(createFreshSave(NOW), 1, "m1-b1", 8, 8, NOW);
    const again = recordSubmission(solved, 1, "m1-b1", 8, 8, NOW);

    expect(again.missions["1"].bossesSolved).toEqual(["m1-b1"]);
    expect(again.bossAttempts["m1-b1"].best).toBe("8/8");
  });
});

describe("recordDrillAttempt", () => {
  test("counts attempts and remembers whether the last one was right", () => {
    const once = recordDrillAttempt(createFreshSave(NOW), "m0-d1", false, NOW);
    const twice = recordDrillAttempt(once, "m0-d1", true, NOW);

    expect(once.drills["m0-d1"]).toEqual({ correct: false, attempts: 1 });
    expect(twice.drills["m0-d1"]).toEqual({ correct: true, attempts: 2 });
  });
});

describe("recordCheckpoint", () => {
  test("keeps the best score", () => {
    const first = recordCheckpoint(createFreshSave(NOW), 0, 4, NOW);
    const worse = recordCheckpoint(first, 0, 2, NOW);

    expect(worse.missions["0"].checkpointBest).toBe(4);
  });
});

describe("hints and the solution gate (A16, invariant 7)", () => {
  test("opens at most 3 hints", () => {
    let save = createFreshSave(NOW);
    for (let i = 0; i < 5; i += 1) save = openHint(save, "m0-b1", NOW);

    expect(save.bossAttempts["m0-b1"].hintsOpened).toBe(3);
  });

  test("shows the solution only after 3 submits and all 3 hints", () => {
    expect(canSeeSolution({ submits: 2, hintsOpened: 3, best: "0/1" })).toBe(false);
    expect(canSeeSolution({ submits: 3, hintsOpened: 2, best: "0/1" })).toBe(false);
    expect(canSeeSolution({ submits: 3, hintsOpened: 3, best: "0/1" })).toBe(true);
    expect(canSeeSolution(undefined)).toBe(false);
  });
});

describe("restoreIfComplete (invariant 2)", () => {
  const LESSONS = ["m0-l1", "m0-l2"];

  function ready(): Save {
    let save = createFreshSave(NOW);
    for (const id of LESSONS) save = markLessonDone(save, 0, id, NOW);
    save = recordCheckpoint(save, 0, 4, NOW);
    return recordSubmission(save, 0, "m0-b1", 1, 1, NOW);
  }

  test("restores the mission and activates the next one when everything is done", () => {
    const restored = restoreIfComplete(ready(), 0, LESSONS, NOW);

    expect(restored.missions["0"].status).toBe("restored");
    expect(restored.missions["1"].status).toBe("active");
  });

  test.each([
    ["a lesson is missing", (s: Save) => ({ ...s, missions: { ...s.missions, "0": { ...s.missions["0"], lessonsDone: ["m0-l1"] } } })],
    ["the checkpoint is below 4", (s: Save) => ({ ...s, missions: { ...s.missions, "0": { ...s.missions["0"], checkpointBest: 3 } } })],
    ["no boss is solved", (s: Save) => ({ ...s, missions: { ...s.missions, "0": { ...s.missions["0"], bossesSolved: [] } } })],
  ])("does nothing when %s", (_, breakIt) => {
    const broken = breakIt(ready());

    expect(restoreIfComplete(broken, 0, LESSONS, NOW)).toBe(broken);
  });

  test("never restores a mission that has no lessons written yet", () => {
    const save = ready();

    expect(restoreIfComplete(save, 0, [], NOW)).toBe(save);
  });
});

describe("applyAndRestore", () => {
  test("reports restored only for the change that completes the mission", () => {
    let save = createFreshSave(NOW);
    save = markLessonDone(save, 0, "m0-l1", NOW);
    save = recordCheckpoint(save, 0, 5, NOW);

    const solve = applyAndRestore(save, (s) => recordSubmission(s, 0, "m0-b1", 1, 1, NOW), 0, ["m0-l1"], NOW);
    const again = applyAndRestore(solve.save, (s) => recordSubmission(s, 0, "m0-b2", 1, 1, NOW), 0, ["m0-l1"], NOW);

    expect(solve.restored).toBe(true);
    expect(solve.save.missions["0"].status).toBe("restored");
    expect(again.restored).toBe(false);
  });
});

describe("warm-up once per calendar day per mission", () => {
  test("is due until shown today", () => {
    const fresh = createFreshSave(NOW);
    const shown = markWarmupShown(fresh, 2, "2026-11-01");

    expect(warmupDue(fresh, 2, "2026-11-01")).toBe(true);
    expect(warmupDue(shown, 2, "2026-11-01")).toBe(false);
    expect(warmupDue(shown, 2, "2026-11-02")).toBe(true);
    expect(warmupDue(shown, 3, "2026-11-01")).toBe(true);
  });
});

describe("setCode", () => {
  test("returns a new save with the code and a fresh timestamp, leaving the original untouched", () => {
    const original = createFreshSave(NOW);
    const later = new Date("2026-11-01T10:05:00Z");

    const updated = setCode(original, "m0-b1", "puts(\"hi\");", later);

    expect(updated.code["m0-b1"]).toBe("puts(\"hi\");");
    expect(updated.updatedAt).toBe(later.toISOString());
    expect(original.code["m0-b1"]).toBeUndefined();
    expect(updated).not.toBe(original);
  });
});
