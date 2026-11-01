import { useState } from "react";
import type { ParsonsDrill } from "../content/lessons";
import { checkParsons, type ParsonsLine } from "./check";
import { seededShuffle } from "./shuffle";

type Props = { drill: ParsonsDrill; isLocked: boolean; onResult: (correct: boolean) => void };

const MAX_INDENT = 4;

/** Tap a line, then tap where it goes; ↑ ↓ ⇤ ⇥ buttons do the same by keyboard (A26: no drag library). */
export function ParsonsInput({ drill, isLocked, onResult }: Props) {
  const [lines, setLines] = useState<ParsonsLine[]>(() => seededShuffle(drill.lines, drill.id).map((l) => ({ text: l.text, indent: 0 })));
  const [selected, setSelected] = useState<number | null>(null);
  const [wrongAt, setWrongAt] = useState<number | null>(null);

  const edit = (next: ParsonsLine[]) => {
    setLines(next);
    setWrongAt(null);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= lines.length || from === to) return;
    const next = [...lines];
    const [line] = next.splice(from, 1);
    next.splice(to, 0, line);
    edit(next);
  };
  const indent = (at: number, delta: number) =>
    edit(lines.map((l, i) => (i === at ? { ...l, indent: Math.min(MAX_INDENT, Math.max(0, l.indent + delta)) } : l)));
  const tap = (at: number) => {
    if (selected === null) return setSelected(at);
    move(selected, at);
    setSelected(null);
  };
  const check = () => {
    const result = checkParsons(drill.lines, lines);
    setWrongAt(result.firstWrong);
    onResult(result.correct);
  };

  return (
    <div className="drill-body">
      <p className="drill-hint">Tap a line, then tap the spot it should move to. Use ⇥ to indent.</p>
      <ol className="parsons" aria-label="Lines to order">
        {lines.map((line, i) => (
          <li key={`${line.text}-${i}`} className={`parsons-line ${selected === i ? "selected" : ""} ${wrongAt === i ? "wrong" : ""}`}>
            <button type="button" className="parsons-text" disabled={isLocked} onClick={() => tap(i)} style={{ paddingLeft: `${12 + line.indent * 24}px` }}>
              {line.text}
            </button>
            <span className="parsons-tools">
              <button type="button" disabled={isLocked || i === 0} onClick={() => move(i, i - 1)} aria-label={`Move line ${i + 1} up`}>↑</button>
              <button type="button" disabled={isLocked || i === lines.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move line ${i + 1} down`}>↓</button>
              <button type="button" disabled={isLocked || line.indent === 0} onClick={() => indent(i, -1)} aria-label={`Outdent line ${i + 1}`}>⇤</button>
              <button type="button" disabled={isLocked || line.indent === MAX_INDENT} onClick={() => indent(i, 1)} aria-label={`Indent line ${i + 1}`}>⇥</button>
            </span>
          </li>
        ))}
      </ol>
      <button className="btn btn-primary" type="button" disabled={isLocked} onClick={check}>
        Check
      </button>
    </div>
  );
}
