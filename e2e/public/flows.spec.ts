import { expect, test, type Page } from "@playwright/test";
import en from "../../src/lib/i18n/en";
import lt from "../../src/lib/i18n/lt";

/**
 * What a visitor without an account can do. Read-only: nothing here signs anyone up, sends
 * a reset link or writes a row, so it runs against prod as safely as against the dev server.
 */

/** Fails the test on any uncaught exception in the page, the kind a visitor sees as a blank screen. */
function watchCrashes(page: Page): string[] {
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(error.message));
  return crashes;
}

test.describe("landing and public pages", () => {
  test("the landing page renders and leads to finding a sitter", async ({ page }) => {
    const crashes = watchCrashes(page);
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator('a[href^="/browse"]').first()).toBeVisible();
    expect(crashes).toEqual([]);
  });

  for (const path of ["/legal", "/legal/terms", "/legal/privacy"]) {
    test(`${path} renders`, async ({ page }) => {
      const crashes = watchCrashes(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(crashes).toEqual([]);
    });
  }

  test("an unknown address answers 404 in the site's own frame", async ({ page }) => {
    const response = await page.goto("/no-such-page-e2e");
    expect(response?.status()).toBe(404);
    await expect(page.getByText(en.common.notFound.title).first()).toBeVisible();
  });

  test("the language switch turns the page Lithuanian and remembers it", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: en.auth.login.title })).toBeVisible();
    await page.getByRole("group", { name: en.common.languageLabel }).getByRole("button", { name: "LT" }).click();
    await expect(page.getByRole("heading", { name: lt.auth.login.title })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: lt.auth.login.title })).toBeVisible();
  });
});

test.describe("the login wall", () => {
  // Every signed-in page sends a visitor to /login and remembers where they were going.
  const protectedPaths = [
    "/dashboard",
    "/browse",
    "/browse?service=grooming",
    "/bookings",
    "/bookings/new?sitter=00000000-0000-0000-0000-000000000000",
    "/messages",
    "/collar",
    "/smart-id-demo",
    "/profile",
    "/pets",
    "/saved",
  ];

  for (const path of protectedPaths) {
    test(`${path} asks to sign in and keeps the destination`, async ({ page }) => {
      const crashes = watchCrashes(page);
      await page.goto(path);
      await page.waitForURL(/\/login\?/);
      expect(new URL(page.url()).searchParams.get("next")).toBe(path);
      await expect(page.locator("#login-email")).toBeVisible();
      expect(crashes).toEqual([]);
    });
  }

  test("the old public sitter list now goes through the wall to /browse", async ({ page }) => {
    await page.goto("/sitters");
    await page.waitForURL(/\/login\?/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/browse");
  });

  test("an offsite next= is never followed", async ({ page }) => {
    await page.goto("/login?next=https://example.com/steal");
    // The sign-up link is where the cleaned next shows: an offsite one is dropped, not carried.
    const signup = page.locator('a[href^="/signup"]').last();
    await expect(signup).toBeVisible();
    expect(await signup.getAttribute("href")).not.toContain("example.com");
  });
});

test.describe("sign-in and sign-up forms", () => {
  test("a wrong password says so in words", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-email").fill("nobody-e2e@petbnb.invalid");
    await page.locator("#login-password").fill("not-the-password-1");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText(en.auth.knownErrors.invalidCredentials)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("sign-up refuses two different passwords before asking the server", async ({ page }) => {
    let signupCalls = 0;
    page.on("request", (request) => { if (request.url().includes("/auth/v1/signup")) signupCalls++; });
    await page.goto("/signup");
    await page.locator("#signup-email").fill("nobody-e2e@petbnb.invalid");
    await page.locator("#signup-password").fill("first-password-1");
    await page.locator("#signup-confirm").fill("second-password-2");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText(en.auth.signup.passwordMismatch)).toBeVisible();
    expect(signupCalls).toBe(0);
  });

  test("sign-up and sign-in link to each other and carry next=", async ({ page }) => {
    await page.goto("/signup?next=%2Fbrowse");
    await page.locator('a[href^="/login"]').first().click();
    await page.waitForURL(/\/login\?/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/browse");
  });

  test("the forgot-password page offers the reset form", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: en.auth.login.forgotPassword }).click();
    await page.waitForURL(/\/forgot-password/);
    await expect(page.getByRole("heading", { name: en.auth.forgot.title })).toBeVisible();
    await expect(page.locator("#forgot-email")).toBeVisible();
  });
});
