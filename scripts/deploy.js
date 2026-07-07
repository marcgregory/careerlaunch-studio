const { spawnSync } = require("node:child_process");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Database migration: try but don't fail if DB is unreachable
// (e.g. cross-region Vercel build cannot reach Neon DB)
try {
  spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
    },
  });
} catch {
  console.warn("⚠️  Skipping prisma migrate deploy — database unreachable (expected in some build environments)");
}

run("npm", ["run", "build", "--workspaces", "--if-present"]);
