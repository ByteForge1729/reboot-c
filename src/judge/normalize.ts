/**
 * Output comparison rule A8: CRLF → LF, trailing spaces/tabs removed per line,
 * trailing empty lines removed. Everything else must match exactly.
 */
export function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

export function outputsMatch(expected: string, actual: string): boolean {
  return normalize(expected) === normalize(actual);
}

/** 1-based number of the first line that differs after normalizing, or null when equal. */
export function firstDifferingLine(expected: string, actual: string): number | null {
  const want = normalize(expected).split("\n");
  const got = normalize(actual).split("\n");
  const longest = Math.max(want.length, got.length);
  for (let i = 0; i < longest; i += 1) {
    if (want[i] !== got[i]) return i + 1;
  }
  return null;
}
