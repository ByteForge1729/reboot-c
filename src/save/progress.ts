import { MISSION_COUNT, type Save } from "./schema";

type BossAttempt = Save["bossAttempts"][string];

export const CHECKPOINT_PASS = 4;
const HINT_COUNT = 3;
const SUBMITS_BEFORE_SOLUTION = 3;

function withMission(save: Save, missionId: number, change: (m: Save["missions"][string]) => Save["missions"][string], now: Date): Save {
  const key = String(missionId);
  const mission = save.missions[key];
  if (!mission) return save;
  return { ...save, missions: { ...save.missions, [key]: change(mission) }, updatedAt: now.toISOString() };
}

/** Local calendar date, YYYY-MM-DD: the warm-up is "once per calendar day" where he lives. */
export function localDateKey(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function recordDrillAttempt(save: Save, drillId: string, correct: boolean, now: Date): Save {
  const attempts = (save.drills[drillId]?.attempts ?? 0) + 1;
  return { ...save, drills: { ...save.drills, [drillId]: { correct, attempts } }, updatedAt: now.toISOString() };
}

export function recordCheckpoint(save: Save, missionId: number, score: number, now: Date): Save {
  return withMission(save, missionId, (m) => ({ ...m, checkpointBest: Math.max(m.checkpointBest, score) }), now);
}

export function openHint(save: Save, problemId: string, now: Date): Save {
  const previous: BossAttempt = save.bossAttempts[problemId] ?? { submits: 0, hintsOpened: 0, best: "0/0" };
  const attempt = { ...previous, hintsOpened: Math.min(HINT_COUNT, previous.hintsOpened + 1) };
  return { ...save, bossAttempts: { ...save.bossAttempts, [problemId]: attempt }, updatedAt: now.toISOString() };
}

/** Invariant 7: the solution appears only after 3 submits and all 3 hints. */
export function canSeeSolution(attempt: BossAttempt | undefined): boolean {
  return !!attempt && attempt.submits >= SUBMITS_BEFORE_SOLUTION && attempt.hintsOpened >= HINT_COUNT;
}

/**
 * Invariant 2: restored = every lesson done + checkpoint ≥ 4 + at least one boss solved.
 * Returns the same object when nothing changes, so callers can skip work.
 */
export function restoreIfComplete(save: Save, missionId: number, lessonIds: readonly string[], now: Date): Save {
  const mission = save.missions[String(missionId)];
  const complete =
    mission?.status === "active" &&
    lessonIds.length > 0 &&
    lessonIds.every((id) => mission.lessonsDone.includes(id)) &&
    mission.checkpointBest >= CHECKPOINT_PASS &&
    mission.bossesSolved.length > 0;
  if (!complete) return save;

  const restored = withMission(save, missionId, (m) => ({ ...m, status: "restored" }), now);
  const next = restored.missions[String(missionId + 1)];
  return next?.status === "locked" ? withMission(restored, missionId + 1, (m) => ({ ...m, status: "active" }), now) : restored;
}

/** Applies a change, then restores the mission if that completed it; `restored` is true only for that change. */
export function applyAndRestore(
  save: Save,
  change: (save: Save) => Save,
  missionId: number,
  lessonIds: readonly string[],
  now: Date,
): { save: Save; restored: boolean } {
  const changed = change(save);
  const next = restoreIfComplete(changed, missionId, lessonIds, now);
  return { save: next, restored: next !== changed };
}

export function warmupDue(save: Save, missionId: number, dateKey: string): boolean {
  return save.warmups[String(missionId)] !== dateKey;
}

export function markWarmupShown(save: Save, missionId: number, dateKey: string): Save {
  return { ...save, warmups: { ...save.warmups, [String(missionId)]: dateKey } };
}

export function restoredCount(save: Save): number {
  return Object.values(save.missions).filter((m) => m.status === "restored").length;
}

/** Station power % shown on the map: round(100 * restored / 14). */
export function stationPower(save: Save): number {
  return Math.round((100 * restoredCount(save)) / MISSION_COUNT);
}

/** The mission to continue: the active one, or the last mission once all are restored. */
export function currentMissionId(save: Save): number {
  const active = Object.entries(save.missions).find(([, m]) => m.status === "active");
  return active ? Number(active[0]) : MISSION_COUNT - 1;
}

/** True once any lesson is done; the Station Map stays hidden until then (spec: story-and-progress). */
export function hasStarted(save: Save): boolean {
  return Object.values(save.missions).some((m) => m.lessonsDone.length > 0 || m.status === "restored");
}

export function markLessonDone(save: Save, missionId: number, lessonId: string, now: Date): Save {
  const key = String(missionId);
  const mission = save.missions[key];
  if (!mission || mission.lessonsDone.includes(lessonId)) return save;
  return {
    ...save,
    missions: { ...save.missions, [key]: { ...mission, lessonsDone: [...mission.lessonsDone, lessonId] } },
    updatedAt: now.toISOString(),
  };
}

function passedCount(best: string): number {
  return Number(best.split("/")[0]) || 0;
}

/** Counts a Submit that reached the judge; marks the boss solved when all tests pass (judge rules 4, 10). */
export function recordSubmission(
  save: Save,
  missionId: number,
  problemId: string,
  passed: number,
  total: number,
  now: Date,
): Save {
  const previous = save.bossAttempts[problemId];
  const score = `${passed}/${total}`;
  const best = previous && passedCount(previous.best) >= passed ? previous.best : score;
  const attempt = { submits: (previous?.submits ?? 0) + 1, hintsOpened: previous?.hintsOpened ?? 0, best };

  const key = String(missionId);
  const mission = save.missions[key];
  const solvedNow = total > 0 && passed === total && mission && !mission.bossesSolved.includes(problemId);
  const missions = solvedNow
    ? { ...save.missions, [key]: { ...mission, bossesSolved: [...mission.bossesSolved, problemId] } }
    : save.missions;

  return {
    ...save,
    missions,
    bossAttempts: { ...save.bossAttempts, [problemId]: attempt },
    updatedAt: now.toISOString(),
  };
}

export function setCode(save: Save, id: string, source: string, now: Date): Save {
  return {
    ...save,
    code: { ...save.code, [id]: source },
    updatedAt: now.toISOString(),
  };
}
