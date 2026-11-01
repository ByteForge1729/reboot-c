import { z } from "zod";

// Shape of the browser save, see spec/03-data-model.md ("Save").
export const MISSION_COUNT = 14;
export const SAVE_VERSION = 1;

const MissionStatusSchema = z.enum(["locked", "active", "restored"]);
export type MissionStatus = z.infer<typeof MissionStatusSchema>;

const MissionProgressSchema = z.object({
  status: MissionStatusSchema,
  lessonsDone: z.array(z.string()),
  checkpointBest: z.number().int().min(0).max(5),
  bossesSolved: z.array(z.string()),
});
export type MissionProgress = z.infer<typeof MissionProgressSchema>;

const BossAttemptSchema = z.object({
  submits: z.number().int().min(0),
  hintsOpened: z.number().int().min(0).max(3),
  best: z.string(),
});

export const SaveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  missions: z.record(z.string(), MissionProgressSchema),
  drills: z.record(z.string(), z.object({ correct: z.boolean(), attempts: z.number().int().min(0) })),
  code: z.record(z.string(), z.string()),
  bossAttempts: z.record(z.string(), BossAttemptSchema),
  settings: z.object({
    reducedMotion: z.boolean(),
    fontSize: z.enum(["normal", "large"]),
  }),
  lastExportAt: z.string().datetime().nullable(),
  /** missionId → local date (YYYY-MM-DD) the warm-up was last shown. Added after v1 shipped, so it defaults. */
  warmups: z.record(z.string(), z.string()).default({}),
});
export type Save = z.infer<typeof SaveSchema>;

function freshMission(id: number): MissionProgress {
  return {
    status: id === 0 ? "active" : "locked",
    lessonsDone: [],
    checkpointBest: 0,
    bossesSolved: [],
  };
}

export function createFreshSave(now: Date): Save {
  const stamp = now.toISOString();
  const missions = Object.fromEntries(
    Array.from({ length: MISSION_COUNT }, (_, id) => [String(id), freshMission(id)]),
  );
  return {
    version: SAVE_VERSION,
    createdAt: stamp,
    updatedAt: stamp,
    missions,
    drills: {},
    code: {},
    bossAttempts: {},
    settings: { reducedMotion: false, fontSize: "normal" },
    lastExportAt: null,
    warmups: {},
  };
}
