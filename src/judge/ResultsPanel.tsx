import type { CSSProperties } from "react";
import { InlineCode } from "../components/RichText";
import type { JudgeState } from "./useJudge";
import type { RunReport, SubmissionReport, TestDetail, TestRow, TranslatedError } from "./types";

const ROW_STAGGER_MS = 60;
const MAX_SHOWN_CHARS = 2000;

const clip = (text: string): string =>
  text.length > MAX_SHOWN_CHARS ? `${text.slice(0, MAX_SHOWN_CHARS)}\n(output cut)` : text;

function CompileErrorCard({ error }: { error: TranslatedError }) {
  return (
    <div className="result-card result-fail" role="alert">
      <p className="result-title">Didn't compile</p>
      <p className="result-plain">
        <InlineCode text={error.plain} />
      </p>
      <details>
        <summary>Show compiler message</summary>
        <pre className="result-pre">{error.raw}</pre>
      </details>
    </div>
  );
}

function Warnings({ text }: { text: string }) {
  if (!text) return null;
  return (
    <details className="result-warnings">
      <summary>Compiler warnings (they don't fail tests)</summary>
      <pre className="result-pre">{text}</pre>
    </details>
  );
}

type LinesProps = { title: string; text: string; highlight: number | null; tone?: "bad" | "want" };

function OutputLines({ title, text, highlight, tone = "bad" }: LinesProps) {
  const trimmed = clip(text).replace(/\n$/, "");
  const lines = trimmed === "" ? [] : trimmed.split("\n");
  // When the first difference is past the end of this output, mark where the missing line should be.
  const missing = highlight !== null && highlight > lines.length;
  return (
    <div className="diff-col">
      <p className="eyebrow">{title}</p>
      <pre className="result-pre">
        {lines.map((line, i) => (
          <span key={i} className={i + 1 === highlight ? `diff-line diff-${tone}` : "diff-line"}>
            {line === "" ? " " : line}
          </span>
        ))}
        {missing && <span className={`diff-line diff-${tone} diff-missing`}>(missing line)</span>}
      </pre>
    </div>
  );
}

function FailureDetail({ detail }: { detail: TestDetail }) {
  return (
    <div className="diff">
      {Object.entries(detail.files ?? {}).map(([name, text]) => (
        <OutputLines key={name} title={`File ${name}`} text={text === "" ? "(empty file)" : text} highlight={null} />
      ))}
      {detail.stdin && <OutputLines title="Input" text={detail.stdin} highlight={null} />}
      <OutputLines title="Expected" text={detail.expected} highlight={detail.firstDiffLine} tone="want" />
      <OutputLines title="Your output" text={detail.actual} highlight={detail.firstDiffLine} />
    </div>
  );
}

function rowLabel(row: TestRow): string {
  return row.visible ? `Test ${row.index + 1}` : `Hidden test ${row.index + 1}`;
}

function SubmissionView({ report }: { report: Extract<SubmissionReport, { kind: "graded" }> }) {
  const allPassed = report.passed === report.total;
  const firstVisibleFailure = report.rows.find((r) => r.verdict !== "pass" && r.detail);
  return (
    <div className={`result-card ${allPassed ? "result-pass" : ""}`}>
      <p className="result-score" role="status">
        <span className={allPassed ? "ok" : "partial"}>{allPassed ? "✔" : "◐"}</span> {report.passed} / {report.total} tests passed
      </p>
      <ol className="test-rows">
        {report.rows.map((row) => (
          <li
            key={row.index}
            className={`test-row ${row.verdict === "pass" ? "row-pass" : "row-fail"}`}
            style={{ animationDelay: `${row.index * ROW_STAGGER_MS}ms` } as CSSProperties}
          >
            <span className="row-mark">{row.verdict === "pass" ? "✔" : "✘"}</span>
            <span className="row-label">{rowLabel(row)}</span>
            <span className="row-message">{row.verdict === "pass" ? "" : row.message}</span>
            <span className="row-time">{row.timeMs !== null ? `${row.timeMs} ms` : ""}</span>
          </li>
        ))}
      </ol>
      {firstVisibleFailure?.detail && <FailureDetail detail={firstVisibleFailure.detail} />}
      <Warnings text={report.warnings} />
    </div>
  );
}

function RunView({ report }: { report: Extract<RunReport, { kind: "ran" }> }) {
  // Judge0 reports exit 0 for killed programs (timeouts), so only show it when the program actually finished.
  const showExit = report.exitCode !== null && (report.verdict === "ok" || report.verdict === "exit-code");
  return (
    <div className={`result-card ${report.verdict === "ok" ? "" : "result-fail"}`}>
      <p className="result-title">
        {report.verdict === "ok" ? "Ran" : report.message}
        <span className="row-time">
          {report.timeMs !== null ? ` · ${report.timeMs} ms` : ""}
          {showExit ? ` · exit ${report.exitCode}` : ""}
        </span>
      </p>
      <p className="eyebrow">Output</p>
      <pre className="result-pre">{clip(report.stdout) || "(nothing printed)"}</pre>
      {report.stderr && (
        <>
          <p className="eyebrow">Errors (stderr)</p>
          <pre className="result-pre">{clip(report.stderr)}</pre>
        </>
      )}
      <Warnings text={report.warnings} />
    </div>
  );
}

export function ResultsPanel({ state }: { state: JudgeState }) {
  switch (state.phase) {
    case "idle":
      return null;
    case "running":
      return (
        <div className="transmitting" role="status">
          <span className="transmit-bar" aria-hidden="true" />
          Transmitting to the compiler…
        </div>
      );
    case "unavailable":
      return (
        <div className="result-card result-warn" role="alert">
          <p className="result-title">Comms are down.</p>
          <p className="result-plain">Your code is saved; try again in a minute.</p>
        </div>
      );
    case "ran":
      return state.report.kind === "compile-error" ? <CompileErrorCard error={state.report.error} /> : <RunView report={state.report} />;
    case "submitted":
      return state.report.kind === "compile-error" ? (
        <CompileErrorCard error={state.report.error} />
      ) : (
        <SubmissionView report={state.report} />
      );
  }
}
