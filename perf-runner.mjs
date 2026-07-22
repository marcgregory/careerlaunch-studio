// Performance harness for the production app.
//
// Measures per-route load, navigation cost, and asset weight under a
// reproducible throttled profile (4x CPU, 10 Mbps / 40 ms RTT). Numbers
// here are how we tell whether a change made the app faster or slower.
//
// Run:
//   node perf-runner.mjs              # warm cache, three core routes
//   node perf-runner.mjs --cold       # cold cache, six routes (full app)
//   node perf-runner.mjs --nav        # click-through on cached home page
//   node perf-runner.mjs --all        # every mode
//
// Set BASE to a different host to point at staging or local.

import { chromium } from "playwright-core";

const BASE = process.env.PERF_BASE || "https://careerlaunch-studio.vercel.app";
const COLD_ROUTES = [
  { name: "home", path: "/" },
  { name: "login", path: "/login" },
  { name: "register", path: "/register" },
  { name: "forgot-password", path: "/forgot-password" },
  { name: "dashboard (unauthed → /login)", path: "/dashboard" },
  { name: "builder (unauthed → /login)", path: "/builder" },
];
const WARM_ROUTES = [
  { name: "home", path: "/" },
  { name: "login", path: "/login" },
  { name: "register", path: "/register" },
];

const NAV_TARGETS = [
  { selector: 'a[href="/dashboard"]', label: "/dashboard" },
  { selector: 'a[href="/builder"]', label: "/builder" },
];

const THROTTLE = {
  latency: 40, // ms
  downloadThroughput: (10 * 1024 * 1024) / 8, // 10 Mbps
  uploadThroughput: (2 * 1024 * 1024) / 8,
  cpuRate: 4,
};

function fmt(n) {
  if (n == null || Number.isNaN(n)) return "n/a";
  return `${n.toFixed(0)}ms`;
}

async function applyThrottle(client, { cold } = {}) {
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: THROTTLE.latency,
    downloadThroughput: THROTTLE.downloadThroughput,
    uploadThroughput: THROTTLE.uploadThroughput,
  });
  await client.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE.cpuRate });
  if (cold) {
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  }
}

async function attachSizer(page) {
  let totalBytes = 0;
  page.on("response", async (r) => {
    try {
      const body = await r.body();
      totalBytes += body.length;
    } catch {}
  });
  return () => totalBytes;
}

async function measurePage(browser, route, { cold } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await applyThrottle(client, { cold });
  const getBytes = await attachSizer(page);

  const t0 = Date.now();
  const resp = await page.goto(BASE + route.path, { waitUntil: "load", timeout: 60000 });
  const loadMs = Date.now() - t0;
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

  const v = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const paint = performance.getEntriesByType("paint");
    return {
      ttfb: nav.responseStart,
      domInteractive: nav.domInteractive,
      domContentLoaded: nav.domContentLoadedEventEnd,
      fcp: paint.find((p) => p.name === "first-contentful-paint")?.startTime,
      lcp: performance.getEntriesByType("largest-contentful-paint").slice(-1)[0]?.startTime,
      jsHeapMB: performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : null,
    };
  });

  const longTasks = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const tasks = [];
        try {
          const po = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) tasks.push(entry.duration);
          });
          po.observe({ entryTypes: ["longtask"] });
          setTimeout(() => {
            po.disconnect();
            const total = tasks.reduce((a, d) => a + Math.max(0, d - 50), 0);
            const longest = tasks.reduce((a, d) => Math.max(a, d), 0);
            resolve({ count: tasks.length, totalBlocking: total, longest });
          }, 1500);
        } catch (e) {
          resolve({ count: -1, error: String(e) });
        }
      })
  );

  const totalBytes = getBytes();
  await context.close();

  return {
    name: route.name,
    path: route.path,
    status: resp?.status(),
    loadMs,
    ttfb: v.ttfb,
    domInteractive: v.domInteractive,
    domContentLoaded: v.domContentLoaded,
    fcp: v.fcp,
    lcp: v.lcp,
    jsHeapMB: v.jsHeapMB,
    longTasks,
    totalKB: totalBytes / 1024,
    cold,
  };
}

async function measureNavigation(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await applyThrottle(client, { cold: false });

  console.log("→ goto home (warm cache baseline)");
  await page.goto(BASE, { waitUntil: "load", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

  const out = [];
  for (const target of NAV_TARGETS) {
    await page.goto(BASE, { waitUntil: "load" });
    const link = await page.$(target.selector);
    if (!link) {
      out.push({ target: target.label, error: "link not found" });
      continue;
    }
    const t0 = Date.now();
    await Promise.all([page.waitForLoadState("domcontentloaded"), link.click()]);
    const dcl = Date.now() - t0;
    await page.waitForLoadState("load");
    const load = Date.now() - t0;
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    const idle = Date.now() - t0;

    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0] || {};
      return { ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd };
    });

    out.push({
      target: target.label,
      dclMs: dcl,
      loadMs: load,
      idleMs: idle,
      navTtfb: nav.ttfb,
      navDcl: nav.dcl,
    });
  }
  await context.close();
  return out;
}

function printPageResult(m) {
  console.log(`\n[${m.name}]  ${m.path}  http=${m.status}  ${m.cold ? "COLD" : "warm"}`);
  console.log(`  load (goto→load):    ${fmt(m.loadMs)}`);
  console.log(`  TTFB:                ${fmt(m.ttfb)}`);
  console.log(`  DOMContentLoaded:    ${fmt(m.domContentLoaded)}`);
  console.log(`  First Contentful:    ${fmt(m.fcp)}`);
  console.log(`  Largest Contentful:  ${fmt(m.lcp)}`);
  console.log(`  JS heap used:        ${m.jsHeapMB?.toFixed(1) ?? "n/a"} MB`);
  console.log(
    `  Long tasks (>50ms):  count=${m.longTasks.count} totalBlocking=${m.longTasks.totalBlocking?.toFixed(0)}ms longest=${m.longTasks.longest?.toFixed(0)}ms`
  );
  console.log(`  Bytes transferred:   ${m.totalKB.toFixed(0)} KB`);
}

function printNavResult(m) {
  console.log(`\n[nav → ${m.target}]`);
  if (m.error) {
    console.log(`  error: ${m.error}`);
    return;
  }
  console.log(`  domcontentloaded: ${fmt(m.dclMs)}`);
  console.log(`  load event:       ${fmt(m.loadMs)}`);
  console.log(`  networkidle:      ${fmt(m.idleMs)}`);
  console.log(`  nav TTFB:         ${fmt(m.navTtfb)}`);
  console.log(`  nav DCL:          ${fmt(m.navDcl)}`);
}

function parseArgs(argv) {
  return argv.slice(2);
}

(async () => {
  const args = parseArgs(process.argv);
  const wantAll = args.includes("--all");
  const wantCold = args.includes("--cold");
  const wantNav = args.includes("--nav");
  // default: warm-cache pass over three core routes
  const wantWarm = !wantCold && !wantNav && !wantAll;

  const browser = await chromium.launch({ headless: true });
  const mode = wantAll ? "all" : wantCold ? "cold" : wantNav ? "nav" : "warm";
  console.log(`=== perf-runner  base=${BASE}  mode=${mode}  throttle=4x CPU, 10Mbps/40ms ===`);

  if (wantWarm || wantAll) {
    for (const r of WARM_ROUTES) {
      process.stdout.write(`measuring ${r.name} (warm)… `);
      const m = await measurePage(browser, r, { cold: false });
      console.log("done");
      printPageResult(m);
    }
  }

  if (wantCold || wantAll) {
    for (const r of COLD_ROUTES) {
      process.stdout.write(`measuring ${r.name} (cold)… `);
      const m = await measurePage(browser, r, { cold: true });
      console.log("done");
      printPageResult(m);
    }
  }

  if (wantNav || wantAll) {
    const navs = await measureNavigation(browser);
    for (const n of navs) printNavResult(n);
  }

  await browser.close();
  console.log("\n=== done ===");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
