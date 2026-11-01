import { useEffect, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

const MS_PER_CHAR = 30;

interface SigmaLineProps {
  text: string;
}

/** SIGMA speaks: typed out at 30 ms/char, click to finish, instant with reduced motion. */
export function SigmaLine({ text }: SigmaLineProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? text.length : 0);

  useEffect(() => {
    if (reduced) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const timer = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearInterval(timer);
          return n;
        }
        return n + 1;
      });
    }, MS_PER_CHAR);
    return () => clearInterval(timer);
  }, [text, reduced]);

  const done = shown >= text.length;

  return (
    <p className="sigma" onClick={() => setShown(text.length)} aria-label={`SIGMA: ${text}`}>
      <span className="sigma-name">SIGMA&gt;</span>
      <span aria-hidden="true">{text.slice(0, shown)}</span>
      {!done && <span className="caret" aria-hidden="true" />}
    </p>
  );
}
