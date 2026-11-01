import { describe, expect, test } from "vitest";
import { splitFill } from "../drills/check";
import { seededShuffle } from "../drills/shuffle";
import { MISSION_COUNT } from "../save/schema";
import { MISSION_CONTENT, allDrillsOf, contentFor, isJudged, warmupPoolBefore } from "./lessons";
import { PROBLEMS } from "./problems";

describe("lesson content", () => {
  test("every mission file is valid and drill ids are unique across all content", () => {
    const ids = MISSION_CONTENT.flatMap((m) => allDrillsOf(m).map((d) => d.id));

    expect(MISSION_CONTENT.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every checkpoint has exactly 5 drills and every lesson 3–5 drills", () => {
    for (const mission of MISSION_CONTENT) {
      expect(mission.checkpoint, `mission ${mission.missionId}`).toHaveLength(5);
      for (const lesson of mission.lessons) expect(lesson.drills.length, lesson.id).toBeGreaterThanOrEqual(3);
    }
  });

  test("fill drills have one answer list per blank, and choice answers are among the options", () => {
    for (const drill of MISSION_CONTENT.flatMap(allDrillsOf)) {
      if (drill.kind === "fill") expect(splitFill(drill.code).length - 1, drill.id).toBe(drill.blanks.length);
      if (drill.kind === "predict" && drill.options) expect(drill.options, drill.id).toContain(drill.answer);
    }
  });

  test("looks content up by mission", () => {
    expect(contentFor(0)?.lessons[0].id).toBe("m0-l1");
    expect(contentFor(14)).toBeUndefined();
  });

  test("every mission 0–13 has lessons, and every mission after the first has 3 bosses (Mission 0 has its one banner boss)", () => {
    for (let id = 0; id < MISSION_COUNT; id++) {
      expect(contentFor(id)?.lessons.length, `mission ${id}`).toBeGreaterThan(0);
      expect(PROBLEMS.filter((p) => p.id.startsWith(`m${id}-`)).length, `mission ${id}`).toBe(id === 0 ? 1 : 3);
    }
  });

  test("multiple-choice answers don't give themselves away by position once shuffled", () => {
    const choices = MISSION_CONTENT.flatMap(allDrillsOf).filter((d) => d.kind === "predict" && d.options);
    const shownFirst = choices.filter((d) => d.kind === "predict" && seededShuffle(d.options!, d.id)[0] === d.answer);

    expect(choices.length).toBeGreaterThan(50);
    expect(shownFirst.length / choices.length).toBeLessThan(0.4);
  });

  test("everything that compiles in Mission 13 links with -pthread", () => {
    const m13 = contentFor(13)!;
    expect(m13.lessons.every((l) => l.example.compileFlags === "-pthread")).toBe(true);
    expect(allDrillsOf(m13).filter(isJudged).every((d) => d.compileFlags === "-pthread")).toBe(true);
    expect(PROBLEMS.filter((p) => p.id.startsWith("m13-")).every((p) => p.compileFlags === "-pthread")).toBe(true);
  });
});

describe("warmupPoolBefore (A13, A28)", () => {
  test("is empty for mission 0 and excludes judged drills", () => {
    expect(warmupPoolBefore(0)).toEqual([]);
    const pool = warmupPoolBefore(1);
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((d) => d.kind !== "fix" && d.kind !== "write")).toBe(true);
    expect(pool.every((d) => d.id.startsWith("m0-"))).toBe(true);
  });
});
