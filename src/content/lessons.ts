import { z } from "zod";
import { TestCaseSchema } from "./problems";

// Lessons, drills and checkpoints: spec/03-data-model.md. Drills live inline in each mission file (A27).
const base = {
  id: z.string().min(1),
  prompt: z.string().min(1),
  explain: z.string().min(1),
  warmupEligible: z.boolean().default(true),
};

const PredictSchema = z.object({
  ...base,
  kind: z.literal("predict"),
  code: z.string().min(1),
  answer: z.string(),
  options: z.array(z.string()).min(2).optional(),
});

const FillSchema = z.object({
  ...base,
  kind: z.literal("fill"),
  code: z.string().min(1),
  blanks: z.array(z.array(z.string().min(1)).min(1)).min(1),
});

const ParsonsSchema = z.object({
  ...base,
  kind: z.literal("parsons"),
  lines: z.array(z.object({ text: z.string().min(1), indent: z.number().int().min(0).max(4) })).min(3),
});

const judged = {
  code: z.string().min(1),
  tests: z.array(TestCaseSchema).min(1),
  solution: z.string().min(1),
  compileFlags: z.string().optional(),
};
const FixSchema = z.object({ ...base, ...judged, kind: z.literal("fix") });
const WriteSchema = z.object({ ...base, ...judged, kind: z.literal("write") });

const DrillSchema = z.discriminatedUnion("kind", [PredictSchema, FillSchema, ParsonsSchema, FixSchema, WriteSchema]);
export type Drill = z.infer<typeof DrillSchema>;
export type PredictDrill = z.infer<typeof PredictSchema>;
export type FillDrill = z.infer<typeof FillSchema>;
export type ParsonsDrill = z.infer<typeof ParsonsSchema>;
export type JudgedDrill = z.infer<typeof FixSchema> | z.infer<typeof WriteSchema>;

const LessonSchema = z.object({
  id: z.string().regex(/^m\d{1,2}-l\d+$/),
  title: z.string().min(1),
  concept: z.string().min(1),
  example: z.object({ source: z.string().min(1), stdin: z.string().default(""), compileFlags: z.string().optional() }),
  predict: PredictSchema,
  drills: z.array(DrillSchema).min(3).max(5),
});
export type Lesson = z.infer<typeof LessonSchema>;

const MissionContentSchema = z.object({
  missionId: z.number().int().min(0),
  cheatsheet: z.string().min(1),
  lessons: z.array(LessonSchema).min(1),
  checkpoint: z.array(DrillSchema).length(5),
});
export type MissionContent = z.infer<typeof MissionContentSchema>;

const files = import.meta.glob("./lessons/*.json", { eager: true, import: "default" });

export const MISSION_CONTENT: readonly MissionContent[] = Object.entries(files)
  .map(([path, raw]) => {
    const parsed = MissionContentSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`Invalid lesson file ${path}: ${parsed.error.message}`);
    return parsed.data;
  })
  .sort((a, b) => a.missionId - b.missionId);

export function contentFor(missionId: number): MissionContent | undefined {
  return MISSION_CONTENT.find((m) => m.missionId === missionId);
}

export function allDrillsOf(mission: MissionContent): Drill[] {
  return [...mission.lessons.flatMap((l) => [l.predict, ...l.drills]), ...mission.checkpoint];
}

export function isJudged(drill: Drill): drill is JudgedDrill {
  return drill.kind === "fix" || drill.kind === "write";
}

/** Warm-up candidates from earlier missions. Judged drills are left out to keep warm-ups quick (A28). */
export function warmupPoolBefore(missionId: number): Drill[] {
  return MISSION_CONTENT.filter((m) => m.missionId < missionId)
    .flatMap(allDrillsOf)
    .filter((d) => d.warmupEligible && !isJudged(d));
}

export function drillById(id: string): Drill | undefined {
  return MISSION_CONTENT.flatMap(allDrillsOf).find((d) => d.id === id);
}
