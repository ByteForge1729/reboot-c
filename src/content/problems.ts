import { z } from "zod";

// Boss problems: spec/03-data-model.md ("Problem", "TestCase"). Content is data (AGENTS.md rule 7).
export const DEFAULT_COMPILER_FLAGS = "-std=gnu17 -Wall -O0 -lm"; // A19, revised by the judge spike

export const TestCaseSchema = z.object({
  stdin: z.string(),
  expected: z.string(),
  visible: z.boolean(),
  files: z.record(z.string()).optional(),
});

const ProblemSchema = z
  .object({
    id: z.string().regex(/^m\d{1,2}-b[1-3]$/),
    title: z.string().min(1),
    difficulty: z.enum(["easy", "medium", "hard"]),
    story: z.string().min(1),
    starter: z.string().min(1),
    tests: z.array(TestCaseSchema).min(1),
    hints: z.array(z.string().min(1)).length(3),
    solution: z.string().min(1),
    compileFlags: z.string().optional(),
  })
  .refine((p) => p.tests.some((t) => t.visible), { message: "needs at least one visible example" });
export type Problem = z.infer<typeof ProblemSchema>;

const files = import.meta.glob("./problems/*.json", { eager: true, import: "default" });

// A malformed content file fails loudly at startup (and in the content test) instead of rendering half a problem.
export const PROBLEMS: readonly Problem[] = Object.entries(files).map(([path, raw]) => {
  const parsed = ProblemSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Invalid problem file ${path}: ${parsed.error.message}`);
  return parsed.data;
});

export function problemById(id: string): Problem | undefined {
  return PROBLEMS.find((p) => p.id === id);
}

export function compilerFlagsFor(problem: Pick<Problem, "compileFlags"> | undefined): string {
  return problem?.compileFlags ? `${DEFAULT_COMPILER_FLAGS} ${problem.compileFlags}` : DEFAULT_COMPILER_FLAGS;
}
