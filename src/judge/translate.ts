import type { TranslatedError } from "./types";

// Plain-English compile errors: spec/04-features/judge.md, translator table (A10).
interface LineRule {
  pattern: RegExp;
  explain: (match: RegExpMatchArray, line: number) => string;
}

const LINE_RULES: readonly LineRule[] = [
  { pattern: /expected ';' before/, explain: (_, l) => `Line ${l}: missing \`;\` at the end of this line.` },
  {
    pattern: /'([^']+)' undeclared/,
    explain: ([, name], l) => `Line ${l}: \`${name}\` is used before it's declared. Typo, or forgot to declare it (like \`int ${name};\`)?`,
  },
  {
    pattern: /implicit declaration of function '(printf|scanf|puts|putchar|getchar)'/,
    explain: ([, fn], l) => `Line ${l}: add \`#include <stdio.h>\` at the top so C knows \`${fn}\`.`,
  },
  {
    pattern: /implicit declaration of function '([^']+)'/,
    explain: ([, fn], l) => `Line ${l}: C doesn't know \`${fn}()\` yet. Declare it above \`main\`, or check the spelling.`,
  },
  {
    pattern: /expected declaration or statement at end of input/,
    explain: () => "A `{` is never closed. Count your braces.",
  },
  {
    pattern: /format '(%[^']+)' expects argument of type/,
    explain: ([, spec], l) =>
      `Line ${l}: the \`${spec}\` code doesn't match the variable's type (\`%d\` int, \`%f\` double, \`%c\` char, \`%s\` string).`,
  },
  {
    pattern: /assignment to expression with array type/,
    explain: (_, l) => `Line ${l}: you can't \`=\` a whole array or string. Use \`strcpy\` or a loop.`,
  },
  {
    pattern: /incompatible pointer|makes integer from pointer|makes pointer from integer/,
    explain: (_, l) => `Line ${l}: mixing a pointer and a normal value. Missing \`&\` or \`*\`?`,
  },
  {
    pattern: /too (few|many) arguments/,
    explain: (_, l) => `Line ${l}: the call doesn't match the function's parameter list.`,
  },
  {
    pattern: /stray '\\\d{3}'/,
    explain: (_, l) => `Line ${l} has a weird character, probably a curly quote pasted from somewhere. Retype the quotes.`,
  },
  {
    pattern: /'else' without a previous 'if'/,
    explain: (_, l) => `Line ${l}: an \`else\` with no matching \`if\`. Often a stray \`;\` right after \`if (...)\`.`,
  },
  { pattern: /redefinition of '([^']+)'/, explain: ([, name], l) => `Line ${l}: \`${name}\` is declared twice.` },
  {
    pattern: /expected '\)' before/,
    explain: (_, l) =>
      `Line ${l}: C expected a \`)\` here. Often a plain \`"\` inside text ended it early (write \`\\"\` instead), or a comma is missing.`,
  },
];

const LINKER_RULES: readonly { pattern: RegExp; plain: (match: RegExpMatchArray) => string }[] = [
  { pattern: /undefined reference to .main'/, plain: () => "There's no `main` function. Every program needs one." },
  {
    pattern: /undefined reference to .pthread_/,
    plain: () => "Thread functions are missing at link time. That's a problem-setup bug, not your code.",
  },
  {
    pattern: /undefined reference to .(\w+)'/,
    plain: ([, fn]) => `\`${fn}()\` is called but never defined. Check the spelling.`,
  },
];

const ERROR_LINE = /^[^:\n]+:(\d+):\d+: (?:fatal )?error: (.*)$/m;

export function translateCompileError(raw: string): TranslatedError {
  const errorLine = raw.match(ERROR_LINE);
  if (errorLine) {
    const line = Number(errorLine[1]);
    const message = errorLine[2];
    for (const rule of LINE_RULES) {
      const match = message.match(rule.pattern);
      if (match) return { line, plain: rule.explain(match, line), raw };
    }
    return { line, plain: `The compiler is confused around line ${line}.`, raw };
  }
  for (const rule of LINKER_RULES) {
    const match = raw.match(rule.pattern);
    if (match) return { line: null, plain: rule.plain(match), raw };
  }
  return { line: null, plain: "The compiler couldn't build this program.", raw };
}
