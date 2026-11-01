import { defineConfig } from "vitest/config";

// The live content check (src/contentCheck/live.check.ts). It calls the real judge, so it's kept out of `npm test`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/contentCheck/live.check.ts"],
  },
});
