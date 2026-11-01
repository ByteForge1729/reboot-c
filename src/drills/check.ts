import { outputsMatch } from "../judge/normalize";

// Drill checking rules: spec/04-features/lessons-and-drills.md rule 3.
const BLANK = "___";

export interface ParsonsLine {
  text: string;
  indent: number;
}

export interface ParsonsResult {
  correct: boolean;
  /** 0-based index of the first misplaced line; only this one is highlighted. */
  firstWrong: number | null;
}

/** Typed answers use the judge's normalization (A8); multiple choice compares the option exactly. */
export function checkPredict(drill: { answer: string; options?: readonly string[] }, response: string): boolean {
  return drill.options ? response === drill.answer : outputsMatch(drill.answer, response);
}

export function splitFill(code: string): string[] {
  return code.split(BLANK);
}

/** Each blank is trimmed, then must equal one accepted token exactly (case-sensitive). */
export function checkFill(blanks: readonly (readonly string[])[], responses: readonly string[]): boolean {
  return blanks.length === responses.length && blanks.every((accepted, i) => accepted.includes(responses[i].trim()));
}

/** Order and indent must both match; lines are compared by text so identical lines are interchangeable. */
export function checkParsons(solution: readonly ParsonsLine[], attempt: readonly ParsonsLine[]): ParsonsResult {
  const firstWrong = solution.findIndex(
    (want, i) => attempt[i]?.text !== want.text || attempt[i]?.indent !== want.indent,
  );
  return firstWrong === -1 && attempt.length === solution.length
    ? { correct: true, firstWrong: null }
    : { correct: false, firstWrong: firstWrong === -1 ? solution.length : firstWrong };
}
