import { expect, test } from "vitest";
import { MISSION_CONTENT } from "../content/lessons";
import { PROBLEMS } from "../content/problems";
import { JudgeUnavailableError, runOnJudge } from "../judge/client";
import { MISSION_COUNT } from "../save/schema";
import { checksForMission, evaluate, parseMissionList, type ContentCheck, type Outcome } from "./checks";

// Runs every content check against the real judge. Not part of `npm test`:
//   npm run check:content                      all missions
//   CHECK_MISSIONS=8-13 npm run check:content  some of them

const CONCURRENCY = 3; // the public judge throttles per IP; 3 batches at a time has been reliable
const RETRIES = 2;
const RETRY_DELAY_MS = 3000;
const RUN_TIMEOUT_MS = 60 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runCheck(check: ContentCheck): Promise<Outcome> {
  for (let attempt = 0; ; attempt++) {
    try {
      return evaluate(check, await runOnJudge(check.source, check.runs, check.flags));
    } catch (error: unknown) {
      if (!(error instanceof JudgeUnavailableError)) throw error;
      if (attempt >= RETRIES) return { status: "problem", detail: `judge unreachable after ${RETRIES + 1} tries: ${error.message}` };
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }
}

async function runAll(checks: readonly ContentCheck[]): Promise<Outcome[]> {
  const outcomes: Outcome[] = new Array(checks.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < checks.length) {
      const index = next++;
      outcomes[index] = await runCheck(checks[index]);
      done++;
      if (done % 25 === 0 || done === checks.length) console.log(`  ${done}/${checks.length} checked`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return outcomes;
}

function report(checks: readonly ContentCheck[], outcomes: readonly Outcome[]): string {
  const lines: string[] = [];
  const missionOf = (c: ContentCheck) => Number(/^m(\d+)-/.exec(c.id)?.[1]);
  for (const id of [...new Set(checks.map(missionOf))]) {
    const indexes = checks.map((c, i) => (missionOf(c) === id ? i : -1)).filter((i) => i >= 0);
    const count = (status: Outcome["status"]) => indexes.filter((i) => outcomes[i].status === status).length;
    lines.push(`Mission ${id}: ${count("ok")} ok, ${count("problem")} problems, ${count("fragment")} fragments`);
  }
  const listed = (status: Outcome["status"], heading: string) => {
    const hits = checks.map((c, i) => ({ c, o: outcomes[i] })).filter(({ o }) => o.status === status);
    if (hits.length === 0) return;
    lines.push("", heading);
    for (const { c, o } of hits) lines.push(`  ✗ ${c.id}: ${"detail" in o ? o.detail : ""}`);
  };
  listed("problem", "PROBLEMS (fix these):");
  listed("fragment", "Fragments that don't compile on their own (read the answers by eye):");
  return lines.join("\n");
}

test(
  "every example, drill and boss behaves as written on the live judge",
  async () => {
    const env = import.meta.env as Record<string, string | undefined>;
    const missionIds = parseMissionList(env.CHECK_MISSIONS, MISSION_COUNT);
    const checks = missionIds.flatMap((id) => {
      const mission = MISSION_CONTENT.find((m) => m.missionId === id);
      return mission ? checksForMission(mission, PROBLEMS) : [];
    });
    console.log(`Checking missions ${missionIds.join(", ")}: ${checks.length} checks on the live judge…`);

    const outcomes = await runAll(checks);
    console.log(report(checks, outcomes));

    const problems = checks.filter((_, i) => outcomes[i].status === "problem").map((c) => c.id);
    expect(problems, "see PROBLEMS above").toEqual([]);
  },
  RUN_TIMEOUT_MS,
);
