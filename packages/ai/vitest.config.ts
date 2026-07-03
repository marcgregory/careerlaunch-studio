import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@careerlaunch/domain": path.resolve(__dirname, "../domain/src/index.ts"),
    },
  },
});
