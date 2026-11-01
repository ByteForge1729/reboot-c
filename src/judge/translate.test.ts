import { describe, expect, test } from "vitest";
import { translateCompileError } from "./translate";

// Real gcc 14.1 output captured from the judge spike (spec/11-spike-results.md).
const MISSING_SEMICOLON = `main.c: In function 'main':
main.c:2:28: error: expected ';' before 'return'
    2 | int main(void){printf("hi")
      |                            ^
      |                            ;
    3 | return 0;}
      | ~~~~~~`;

describe("translateCompileError", () => {
  test("explains a missing semicolon with the right line", () => {
    const result = translateCompileError(MISSING_SEMICOLON);

    expect(result.line).toBe(2);
    expect(result.plain).toContain("missing `;`");
    expect(result.raw).toBe(MISSING_SEMICOLON);
  });

  test("names the undeclared variable", () => {
    const result = translateCompileError("main.c:4:5: error: 'oxygen' undeclared (first use in this function)");

    expect(result.plain).toBe("Line 4: `oxygen` is used before it's declared. Typo, or forgot to declare it (like `int oxygen;`)?");
  });

  test("asks for stdio.h when printf is missing", () => {
    const result = translateCompileError(
      "main.c:2:5: error: implicit declaration of function 'printf' [-Wimplicit-function-declaration]",
    );

    expect(result.plain).toContain("#include <stdio.h>");
  });

  test("explains an unknown function", () => {
    const result = translateCompileError("main.c:7:3: error: implicit declaration of function 'refuel' [-Wimplicit-function-declaration]");

    expect(result.plain).toBe("Line 7: C doesn't know `refuel()` yet. Declare it above `main`, or check the spelling.");
  });

  test("explains a missing main from the linker", () => {
    const result = translateCompileError("/usr/bin/ld: (.text+0x1b): undefined reference to `main'\ncollect2: error: ld returned 1 exit status");

    expect(result.plain).toBe("There's no `main` function. Every program needs one.");
    expect(result.line).toBeNull();
  });

  test("explains curly quotes pasted from elsewhere", () => {
    const result = translateCompileError("main.c:3:12: error: stray '\\342' in program");

    expect(result.plain).toContain("curly quote");
  });

  test("explains an unescaped quote that ends the text early (real gcc 14 output)", () => {
    const result = translateCompileError("main.c:4:20: error: expected ')' before 'OK'");

    expect(result.line).toBe(4);
    expect(result.plain).toContain("`\\\"`");
  });

  test("falls back to the line number for anything unknown", () => {
    const result = translateCompileError("main.c:9:1: error: something unusual happened");

    expect(result.plain).toBe("The compiler is confused around line 9.");
  });
});
