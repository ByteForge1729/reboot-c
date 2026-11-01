import { describe, expect, test, vi } from "vitest";
import { JudgeUnavailableError, POLL_TIMEOUT_MS, runOnJudge, toBase64, type JudgeDeps } from "./client";
import { bytesToBase64, storeZip } from "./zip";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function judgeResult(statusId: number, stdout = "") {
  return {
    status: { id: statusId, description: statusId === 3 ? "Accepted" : "Processing" },
    stdout: stdout ? toBase64(stdout) : null,
    stderr: null,
    compile_output: null,
    time: "0.002",
    exit_code: statusId === 3 ? 0 : null,
  };
}

/** Fake judge: answers the batch POST with tokens, then serves queued poll responses. */
function fakeJudge(polls: unknown[][]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let poll = 0;
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { submissions: unknown[] };
      return jsonResponse(body.submissions.map((_, i) => ({ token: `t${i}` })), 201);
    }
    const submissions = polls[Math.min(poll, polls.length - 1)];
    poll += 1;
    return jsonResponse({ submissions });
  });
  let clock = 0;
  const deps: JudgeDeps = {
    fetchFn: fetchFn as unknown as typeof fetch,
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
  };
  return { deps, calls };
}

describe("runOnJudge", () => {
  test("sends one base64 submission per input with language, flags and limits, and no expected output", async () => {
    const { deps, calls } = fakeJudge([[judgeResult(3, "°"), judgeResult(3)]]);

    await runOnJudge("int main(void){}", ["1", "2"], "-std=gnu17", deps);

    const post = calls[0];
    expect(post.url).toBe("https://ce.judge0.com/submissions/batch?base64_encoded=true");
    expect(new Headers(post.init?.headers).has("User-Agent")).toBe(false);
    const sent = JSON.parse(String(post.init?.body)).submissions;
    expect(sent).toHaveLength(2);
    expect(sent[0]).toEqual({
      language_id: 103,
      source_code: toBase64("int main(void){}"),
      stdin: toBase64("1"),
      compiler_options: "-std=gnu17",
      cpu_time_limit: 2,
      wall_time_limit: 5,
      memory_limit: 131072,
    });
  });

  test("attaches a run's files as a base64 zip and leaves file-less runs alone", async () => {
    const { deps, calls } = fakeJudge([[judgeResult(3), judgeResult(3)]]);

    await runOnJudge("x", [{ stdin: "", files: { "log.txt": "ERROR\n" } }, "plain"], "", deps);

    const sent = JSON.parse(String(calls[0].init?.body)).submissions;
    expect(sent[0].additional_files).toBe(bytesToBase64(storeZip({ "log.txt": "ERROR\n" })));
    expect(sent[1]).not.toHaveProperty("additional_files");
    expect(sent[1].stdin).toBe(toBase64("plain"));
  });

  test("polls until every submission is finished, then decodes UTF-8 output", async () => {
    const { deps, calls } = fakeJudge([[judgeResult(1)], [judgeResult(2)], [judgeResult(3, "O₂ 42%\n")]]);

    const [only] = await runOnJudge("x", [""], "", deps);

    expect(calls).toHaveLength(4);
    expect(only).toMatchObject({ statusId: 3, stdout: "O₂ 42%\n", exitCode: 0, timeSec: 0.002 });
  });

  test("gives up after 30 s of waiting", async () => {
    const { deps } = fakeJudge([[judgeResult(1)]]);

    await expect(runOnJudge("x", [""], "", deps)).rejects.toBeInstanceOf(JudgeUnavailableError);
    expect(POLL_TIMEOUT_MS).toBe(30_000);
  });

  test("treats rate limiting as comms down", async () => {
    const deps: JudgeDeps = {
      fetchFn: (async () => jsonResponse({ error: "too many" }, 429)) as unknown as typeof fetch,
      sleep: async () => undefined,
      now: () => 0,
    };

    await expect(runOnJudge("x", [""], "", deps)).rejects.toBeInstanceOf(JudgeUnavailableError);
  });

  test("treats a network failure as comms down", async () => {
    const deps: JudgeDeps = {
      fetchFn: (async () => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch,
      sleep: async () => undefined,
      now: () => 0,
    };

    await expect(runOnJudge("x", [""], "", deps)).rejects.toBeInstanceOf(JudgeUnavailableError);
  });

  test("treats a judge internal error as comms down", async () => {
    const { deps } = fakeJudge([[judgeResult(13)]]);

    await expect(runOnJudge("x", [""], "", deps)).rejects.toBeInstanceOf(JudgeUnavailableError);
  });
});
