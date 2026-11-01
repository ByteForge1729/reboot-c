import { z } from "zod";
import type { JudgeRun, RawResult } from "./types";
import { bytesToBase64, storeZip } from "./zip";

// Judge0 CE public instance, verified in spec/11-spike-results.md. No key, no custom headers.
export const JUDGE_BASE_URL = "https://ce.judge0.com";
export const C_LANGUAGE_ID = 103; // C (GCC 14.1.0)
export const POLL_INTERVAL_MS = 500;
export const POLL_TIMEOUT_MS = 30_000;
const LIMITS = { cpu_time_limit: 2, wall_time_limit: 5, memory_limit: 131072 } as const; // A21
const FIRST_SYSTEM_ERROR_STATUS = 13; // 13 internal error, 14 exec format error
const FIELDS = "status,stdout,stderr,compile_output,time,exit_code";

export class JudgeUnavailableError extends Error {
  constructor(reason: string, options?: { cause?: unknown }) {
    super(`Judge unavailable: ${reason}`, options);
    this.name = "JudgeUnavailableError";
  }
}

export interface JudgeDeps {
  fetchFn: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

const defaultDeps: JudgeDeps = {
  fetchFn: (input, init) => fetch(input, init),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
};

export function toBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

function fromBase64(encoded: string | null | undefined): string {
  if (!encoded) return "";
  return new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
}

const TokensSchema = z.array(z.object({ token: z.string() }));
const PollSchema = z.object({
  submissions: z.array(
    z.object({
      status: z.object({ id: z.number(), description: z.string() }),
      stdout: z.string().nullish(),
      stderr: z.string().nullish(),
      compile_output: z.string().nullish(),
      time: z.string().nullish(),
      exit_code: z.number().nullish(),
    }),
  ),
});
type PolledSubmission = z.infer<typeof PollSchema>["submissions"][number];

async function requestJson(deps: JudgeDeps, url: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await deps.fetchFn(url, init);
  } catch (error: unknown) {
    throw new JudgeUnavailableError("network error", { cause: error });
  }
  if (!response.ok) throw new JudgeUnavailableError(`HTTP ${response.status}`);
  try {
    return await response.json();
  } catch (error: unknown) {
    throw new JudgeUnavailableError("unreadable response", { cause: error });
  }
}

function decode(s: PolledSubmission): RawResult {
  return {
    statusId: s.status.id,
    statusDescription: s.status.description,
    stdout: fromBase64(s.stdout),
    stderr: fromBase64(s.stderr),
    compileOutput: fromBase64(s.compile_output),
    timeSec: s.time ? Number(s.time) : null,
    exitCode: s.exit_code ?? null,
  };
}

function toSubmission(source: string, run: string | JudgeRun, compilerFlags: string) {
  const { stdin, files } = typeof run === "string" ? { stdin: run, files: undefined } : run;
  return {
    language_id: C_LANGUAGE_ID,
    source_code: toBase64(source),
    stdin: toBase64(stdin),
    compiler_options: compilerFlags,
    ...LIMITS,
    // Judge0 unpacks this zip next to main.c, so fopen("log.txt") finds the fixture (A25).
    ...(files && Object.keys(files).length > 0 ? { additional_files: bytesToBase64(storeZip(files)) } : {}),
  };
}

/** Compiles and runs `source` once per run (a stdin, plus optional files); resolves when every run has finished. */
export async function runOnJudge(
  source: string,
  runs: readonly (string | JudgeRun)[],
  compilerFlags: string,
  deps: JudgeDeps = defaultDeps,
): Promise<RawResult[]> {
  const submissions = runs.map((run) => toSubmission(source, run, compilerFlags));
  const posted = TokensSchema.safeParse(
    await requestJson(deps, `${JUDGE_BASE_URL}/submissions/batch?base64_encoded=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissions }),
    }),
  );
  if (!posted.success) throw new JudgeUnavailableError("submission rejected");
  const tokens = posted.data.map((t) => t.token).join(",");

  const started = deps.now();
  for (;;) {
    await deps.sleep(POLL_INTERVAL_MS);
    if (deps.now() - started > POLL_TIMEOUT_MS) throw new JudgeUnavailableError("timed out");
    const polled = PollSchema.safeParse(
      await requestJson(deps, `${JUDGE_BASE_URL}/submissions/batch?tokens=${tokens}&base64_encoded=true&fields=${FIELDS}`),
    );
    if (!polled.success) throw new JudgeUnavailableError("unexpected poll response");
    const results = polled.data.submissions;
    if (results.some((s) => s.status.id <= 2)) continue; // 1 queued, 2 processing
    if (results.some((s) => s.status.id >= FIRST_SYSTEM_ERROR_STATUS)) throw new JudgeUnavailableError("judge error");
    return results.map(decode);
  }
}
