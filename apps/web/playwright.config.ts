import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

loadEnvFile(resolve(__dirname, "..", "..", ".env"));
loadEnvFile(resolve(__dirname, "..", "..", ".env.local"));
loadEnvFile(resolve(__dirname, ".env"));
loadEnvFile(resolve(__dirname, ".env.local"));

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev --workspace @careerlaunch/web",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/.exec(line);
    if (!match || match[1] in process.env) continue;

    process.env[match[1]] = parseEnvValue(match[2] ?? "");
  }
}

function parseEnvValue(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}
