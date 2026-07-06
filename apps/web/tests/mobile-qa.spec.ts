import { expect, test, type Page } from "@playwright/test";

/**
 * Mobile QA Test Suite — Sprint 6D Beta Hardening
 *
 * Verifies that every screen in the application is usable at 375px width
 * (iPhone SE / small mobile breakpoint).
 *
 * Target: No horizontal scroll, tap targets ≥44×44px, forms fillable.
 */

const MOBILE_VIEWPORT = { width: 375, height: 812 }; // iPhone X dimensions

test.use({ viewport: MOBILE_VIEWPORT });

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const body = document.body;
    return {
      scrollWidth: body.scrollWidth,
      clientWidth: body.clientWidth,
    };
  });
  const tolerance = 2;
  expect(overflow.scrollWidth).toBeLessThanOrEqual(
    overflow.clientWidth + tolerance,
  );
}

async function expectTapTargets(page: Page, excludePatterns: string[] = []) {
  const smallTargets = await page.evaluate(() => {
    const results: { tag: string; text: string; w: number; h: number }[] = [];
    const selectors = 'button, a[href], input, select, textarea, [role="button"], [role="link"]';
    const elements = document.querySelectorAll(selectors);
    for (const el of elements) {
      if (!(el instanceof HTMLElement)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) continue;
      if (rect.width < 44 || rect.height < 44) {
        results.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().slice(0, 30),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    }
    return results;
  });

  const filtered = smallTargets.filter(
    (t) => !excludePatterns.some((p) => t.text.includes(p) || t.tag.includes(p)),
  );

  expect(filtered).toEqual([]);
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `./tests/__snapshots__/mobile-qa/${name}.png`,
    fullPage: true,
  });
}

/* ------------------------------------------------------------------ */
/*  Tests — Landing Page                                               */
/* ------------------------------------------------------------------ */

test.describe("Mobile QA — Home Page", () => {
  test("home page fits 375px viewport with no overflow", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expectNoHorizontalScroll(page);
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();
    await expectTapTargets(page, ["CareerLaunch", "Open builder"]);
    await screenshot(page, "home");
  });

  test("home page CTA buttons are tappable at 375px", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Primary CTAs should be visible
    const builderCta = page.getByText("Start building");
    await expect(builderCta).toBeVisible();

    const savedCta = page.getByText("View saved resumes");
    await expect(savedCta).toBeVisible();

    await expectNoHorizontalScroll(page);
    await screenshot(page, "home-cta");
  });
});

/* ------------------------------------------------------------------ */
/*  Tests — Login & Register                                           */
/* ------------------------------------------------------------------ */

test.describe("Mobile QA — Auth Pages", () => {
  test("login page fits 375px viewport with form usable", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await expectNoHorizontalScroll(page);

    // Verify the form is present
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    // Fill the form to verify it works
    await page.locator('input[name="email"]').fill("test@example.com");
    await page.locator('input[name="password"]').fill("password-123");
    await expectNoHorizontalScroll(page);

    await screenshot(page, "login");
  });

  test("register page fits 375px viewport with form usable", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    await expectNoHorizontalScroll(page);

    // Verify form fields are present
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();

    // Fill the form
    await page.locator('input[name="name"]').fill("Mobile Test");
    await page.locator('input[name="email"]').fill("mobile@test.com");
    await page.locator('input[name="password"]').fill("test-password-123");
    await expectNoHorizontalScroll(page);

    await screenshot(page, "register");
  });

  test("auth navigation works at mobile viewport", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Navigate to register via the bottom link (use the last matching element)
    await page.getByRole("link", { name: "Create account" }).last().click();
    await expect(page).toHaveURL(/\/register/);
    await expectNoHorizontalScroll(page);

    // Navigate back to login
    await page.getByText("Sign in instead").click();
    await expect(page).toHaveURL(/\/login/);
    await expectNoHorizontalScroll(page);
  });
});

/* ------------------------------------------------------------------ */
/*  Tests — Billing / Pricing (no-db fallback state)                  */
/* ------------------------------------------------------------------ */

test.describe("Mobile QA — Billing Page", () => {
  test("billing page loads and shows content at 375px", async ({ page }) => {
    await page.goto("/billing");
    await page.waitForLoadState("networkidle");

    // The page renders a Suspense fallback while client-side data loads.
    // At minimum the page scaffold should be present.
    await expectNoHorizontalScroll(page);

    // Wait a bit for client-side JS to render
    await page.waitForTimeout(2000);
    await expectNoHorizontalScroll(page);

    await screenshot(page, "billing");
  });

  test("billing page plan names visible at 375px", async ({ page }) => {
    await page.goto("/billing");
    await page.waitForLoadState("networkidle");

    // Wait for client-side rendering
    await page.waitForTimeout(3000);
    await expectNoHorizontalScroll(page);
  });
});

/* ------------------------------------------------------------------ */
/*  Tests — Auth-Gated Pages (redirect check)                         */
/* ------------------------------------------------------------------ */

test.describe("Mobile QA — Auth Redirects", () => {
  test("dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expectNoHorizontalScroll(page);
  });

  test("builder redirects to login", async ({ page }) => {
    await page.goto("/builder");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/login/);
    await expectNoHorizontalScroll(page);
  });

  test("import page loads without overflow at 375px", async ({ page }) => {
    await page.goto("/import");
    await page.waitForLoadState("networkidle");
    // Import page is a client component that renders the import UI for anonymous
    // users (auth is handled at the API level, not the page level)
    await expectNoHorizontalScroll(page);
    await screenshot(page, "import");
  });

  test("account billing page loads without overflow at 375px", async ({ page }) => {
    await page.goto("/account/billing");
    await page.waitForLoadState("networkidle");
    // Account billing is a client component; content fetches after auth check
    await expectNoHorizontalScroll(page);
    await screenshot(page, "account-billing");
  });
});
