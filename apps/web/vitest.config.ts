import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@careerlaunch/domain": path.resolve(__dirname, "../../packages/domain/src/index.ts"),
      "@careerlaunch/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: [path.resolve(__dirname, "vitest.setup.ts")],
    include: ["**/__tests__/**/*.test.ts"],
  },
});
