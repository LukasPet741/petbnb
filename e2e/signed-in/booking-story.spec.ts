import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import en from "../../src/lib/i18n/en";

/**
 * The demo story, told by two test accounts: a sitter and an owner.
 *
 * profile → Smart-ID badge → pet → request with an offer → counter-offer → accept → chat →
 * the stay starts → completed → a review each way → the collar page.
 *
 * WRITES TO PROD AND SENDS REAL EMAIL. Every step lands in the one Supabase project, and every
 * booking event mails both accounts (Gmail aliases that reach Lukas's inbox). Run it only with
 * his yes: `npm run e2e:signed-in`. The accounts come from .env.e2e (git-ignored).
 *
 * Re-runnable: profile, badge and pet are set up only when missing, and each run books its own
 * stay, found again by the note it carries. The run ends with sitter mode off, so the test
 * sitter is not listed on /browse between runs.
 */

interface Account { email: string; password: string; name: string; phone: string }

const OWNER: Account = {
  email: process.env.E2E_OWNER_EMAIL ?? "",
  password: process.env.E2E_OWNER_PASSWORD ?? "",
  name: "E2E Owner",
  phone: "60000001",
};
const SITTER: Account = {
  email: process.env.E2E_SITTER_EMAIL ?? "",
  password: process.env.E2E_SITTER_PASSWORD ?? "",
  name: "E2E Sitter",
  phone: "60000002",
};
const CITY = "Vilnius";
const PET = "E2E Rex";
// The sitter's walking price, the owner's opening offer and the sitter's counter. The database's
// rules: owner ≥ ceil(asking / 2) and < asking; sitter < asking and > the owner's latest.
const ASKING = 20;
const OFFER = 12;
const COUNTER = 16;
const RUN = new Date().toISOString().slice(0, 16).replace("T", " ");
const NOTE = `E2E run ${RUN}`;

test.skip(
  !OWNER.email || !OWNER.password || !SITTER.email || !SITTER.password,
  "Set E2E_OWNER_EMAIL/PASSWORD and E2E_SITTER_EMAIL/PASSWORD in .env.e2e",
);
test.describe.configure({ mode: "serial" });

/** An i18n template ("Accept at {price}") as a pattern that matches any filled-in value. */
function tpl(template: string): RegExp {
  const parts = template.split(/\{[^}]+\}/).map((part) => part.replace(/[.*+?^$()|[\]\\]/g, "\\$&"));
  return new RegExp(parts.join(".+"));
}

/** "YYYY-MM-DDTHH:mm" in the browser's (Vilnius) wall time, what a datetime-local input takes. */
function localInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(date);
  return parts.replace(" ", "T");
}

async function signIn(browser: Browser, account: Account): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator("#login-email").fill(account.email);
  await page.locator("#login-password").fill(account.password);
  await page.locator('form button[type="submit"]').click();
  // A new account is sent on to /profile to finish it; an existing one lands on the dashboard.
  await page.waitForURL(/\/(dashboard|profile)/);
  return page;
}

/** The signed-in user's id, from the session supabase-js keeps in localStorage. */
async function userId(page: Page): Promise<string> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) return JSON.parse(localStorage.getItem(key)!).user.id as string;
    }
    throw new Error("no Supabase session in localStorage");
  });
}

/** The booking card on /bookings that carries this booking's thread link. */
function bookingCard(page: Page, bookingId: string): Locator {
  return page.locator("div.glass-card").filter({ has: page.locator(`a[href="/messages/${bookingId}"]`) });
}

let owner: Page;
let sitter: Page;
let sitterId: string;
let bookingId: string;
let startsAt: number;

test.beforeAll(async ({ browser }) => {
  owner = await signIn(browser, OWNER);
  sitter = await signIn(browser, SITTER);
  sitterId = await userId(sitter);
});

test.afterAll(async () => {
  await owner?.context().close();
  await sitter?.context().close();
});

test("both accounts finish their profile", async () => {
  for (const [page, account] of [[owner, OWNER], [sitter, SITTER]] as const) {
    await page.goto("/profile");
    const name = page.getByLabel(en.appPages.profile.fullNameLabel);
    await expect(name).toBeVisible();
    if ((await name.inputValue()) === account.name) continue;
    await name.fill(account.name);
    await page.getByLabel(en.appPages.profile.cityLabel).fill(CITY);
    await page.locator("#profile-phone").fill(account.phone);
    await page.getByRole("button", { name: en.appPages.profile.saveChangesButton }).click();
    await expect(page.getByText(en.appPages.profile.profileSavedMessage)).toBeVisible();
  }
  // Without a reload (page.goto would reload and hide it): the app layout's own copy of the
  // profile must be complete too, or it sends the account straight back to /profile (2026-10-18).
  for (const page of [owner, sitter]) {
    await page.locator('a[href="/collar"]:visible').first().click();
    await page.waitForURL(/\/collar$/);
    await page.waitForTimeout(1_500);
    await expect(page).toHaveURL(/\/collar$/);
  }
});

test("the sitter switches sitter mode on and prices a walk", async () => {
  await sitter.goto("/profile");
  await expect(sitter.getByLabel(en.appPages.profile.fullNameLabel)).toHaveValue(SITTER.name);
  await sitter.getByRole("button", { name: en.appPages.profile.tabSitterSettings }).click();
  const mode = sitter.getByRole("switch", { name: en.appPages.profile.sitterModeLabel });
  if ((await mode.getAttribute("aria-checked")) !== "true") await mode.click();
  await expect(mode).toHaveAttribute("aria-checked", "true");
  const walking = sitter.getByRole("checkbox", { name: en.common.services.walking });
  if (!(await walking.isChecked())) await walking.check({ force: true });
  const service = en.common.services.walking;
  await sitter.getByLabel(en.appPages.profile.priceAmountLabel.replace("{service}", service)).fill(String(ASKING));
  await sitter.getByLabel(en.appPages.profile.pricePeriodLabel.replace("{service}", service)).selectOption("1");
  await sitter.getByRole("button", { name: en.appPages.profile.saveProfileButton }).click();
  await expect(sitter.getByText(en.appPages.profile.profileSavedMessage)).toBeVisible();
});

test("the sitter confirms who they are with the Smart-ID demo", async () => {
  test.setTimeout(150_000);
  await sitter.goto("/profile");
  await expect(sitter.getByLabel(en.appPages.profile.fullNameLabel)).toHaveValue(SITTER.name);
  // Already verified on an earlier run: SK's demo allows five tries an hour, so don't spend one.
  if (await sitter.getByRole("img", { name: en.common.verification.sealDemo }).count()) return;
  await sitter.goto("/smart-id-demo");
  await sitter.getByRole("button", { name: new RegExp(en.appPages.smartIdDemo.identities.ok) }).click();
  await sitter.getByRole("button", { name: en.appPages.smartIdDemo.start }).click();
  await expect(sitter.getByRole("heading", { name: en.appPages.smartIdDemo.okTitle })).toBeVisible({ timeout: 120_000 });
  await expect(sitter.getByText(en.appPages.smartIdDemo.badgeSaved)).toBeVisible({ timeout: 30_000 });
});

test("the owner adds a pet", async () => {
  await owner.goto("/pets");
  await expect(owner.getByRole("heading", { name: en.appPages.pets.title })).toBeVisible();
  // Count only once the list has answered: counting during the loading state added a second pet.
  await expect(owner.getByText(en.appPages.pets.loadingText)).toHaveCount(0);
  const pets = owner.getByText(PET, { exact: true });
  // Exactly one test pet. A spare one has no bookings, so it is removed outright (the newest).
  while ((await pets.count()) > 1) {
    const before = await pets.count();
    await owner.getByRole("button", { name: en.appPages.petCard.removeLabel }).last().click();
    await owner.getByRole("button", { name: en.appPages.pets.removeButton, exact: true }).click();
    await expect(pets).toHaveCount(before - 1);
  }
  if (await pets.count()) return;
  await owner.goto("/pets/new");
  await owner.locator("#pet-name").fill(PET);
  await owner.locator('form button[type="submit"]').click();
  await owner.waitForURL(/\/pets$/);
  await expect(owner.getByText(PET, { exact: true })).toBeVisible();
});

test("the owner requests a walk and opens with an offer", async () => {
  // Starts two minutes from now, so the sitter can complete it later in this same run: the
  // database refuses to complete a stay before it starts.
  const start = new Date(Date.now() + 2 * 60_000);
  startsAt = start.getTime();
  const end = new Date(start.getTime() + 2 * 60 * 60_000);
  await owner.goto(`/bookings/new?sitter=${sitterId}`);
  await expect(owner.getByRole("radio", { name: en.common.services.walking })).toBeChecked();
  await owner.getByLabel(en.appPages.bookingsNew.petLabel).selectOption({ label: PET });
  await owner.getByLabel(en.appPages.bookingsNew.startLabel).fill(localInputValue(start));
  await owner.getByLabel(en.appPages.bookingsNew.endLabel).fill(localInputValue(end));
  await owner.getByRole("radio", { name: en.appPages.bookingsNew.makeOffer }).check();
  await owner.locator('input[inputmode="numeric"]').first().fill(String(OFFER));
  await owner.getByLabel(en.appPages.bookingsNew.notesLabel).fill(NOTE);
  await owner.getByRole("button", { name: en.appPages.bookingsNew.sendRequestButton }).click();
  await owner.waitForURL(/\/bookings$/);
  const card = owner.locator("div.glass-card").filter({ hasText: NOTE });
  await expect(card).toBeVisible();
  await expect(card.getByText(en.appPages.bookings.waitingForSitter)).toBeVisible();
  const href = await card.locator('a[href^="/messages/"]').getAttribute("href");
  bookingId = href!.split("/").pop()!;
});

test("the sitter sees the request and counters in the thread", async () => {
  await sitter.goto("/bookings");
  const card = bookingCard(sitter, bookingId);
  await expect(card).toBeVisible();
  await expect(card.getByText(NOTE)).toBeVisible();
  await expect(card.getByRole("button", { name: en.appPages.bookings.declineButton })).toBeVisible();
  await sitter.goto(`/messages/${bookingId}`);
  await sitter.getByRole("button", { name: en.messages.offer.counter }).first().click();
  await sitter.getByLabel(en.messages.offer.amountLabel).fill(String(COUNTER));
  await sitter.getByRole("button", { name: en.messages.offer.submit }).click();
  await expect(sitter.getByText(en.messages.offer.yours).last()).toBeVisible();
});

test("the owner agrees to the counter-offer", async () => {
  await owner.goto("/bookings");
  const card = bookingCard(owner, bookingId);
  await card.getByRole("button", { name: tpl(en.appPages.bookings.agreeForButton) }).click();
  await expect(owner.getByText(en.appPages.bookings.toastAccepted)).toBeVisible();
  await expect(card.getByText(tpl(en.common.pricing.agreed))).toContainText(String(COUNTER));
});

test("the two chat in the booking's thread", async () => {
  const hello = `Labas! ${NOTE}`;
  await owner.goto(`/messages/${bookingId}`);
  await owner.getByLabel(en.messages.composerPlaceholder).fill(hello);
  await owner.getByRole("button", { name: en.messages.send }).click();
  await expect(owner.getByRole("log").getByText(hello)).toBeVisible();
  await sitter.goto(`/messages/${bookingId}`);
  await expect(sitter.getByRole("log").getByText(hello)).toBeVisible();
});

test("the sitter completes the walk once it has started", async () => {
  test.setTimeout(240_000);
  await sitter.goto("/bookings");
  const card = bookingCard(sitter, bookingId);
  const complete = card.getByRole("button", { name: en.appPages.bookings.markCompletedButton });
  await expect(complete).toBeVisible();
  // Wait out the minutes to the start (the datetime field drops seconds, so add a minute):
  // a click before it is refused by the database.
  await sitter.waitForTimeout(Math.max(0, startsAt + 60_000 - Date.now()));
  await complete.click();
  await expect(sitter.getByText(en.appPages.bookings.toastCompleted)).toBeVisible();
  // The status pill; the progress strip under it names the same step.
  await expect(card.getByText(en.common.bookingStatus.completed).first()).toBeVisible();
});

test("owner and sitter review each other", async () => {
  for (const [page, words] of [[owner, `Great walk. ${NOTE}`], [sitter, `Lovely dog. ${NOTE}`]] as const) {
    await page.goto("/bookings");
    const card = bookingCard(page, bookingId);
    await card.getByRole("button", { name: en.sitters.reviews.form.leave }).click();
    await card.getByRole("radio", { name: en.sitters.reviews.form.starLabel.replace("{count}", "5") }).check({ force: true });
    await card.getByLabel(en.sitters.reviews.form.bodyLabel).fill(words);
    await card.getByRole("button", { name: en.sitters.reviews.form.post }).click();
    await expect(card.getByText(en.sitters.reviews.form.yourReview)).toBeVisible();
  }
});

test("the collar page opens and refuses a code no collar has", async () => {
  await owner.goto("/collar");
  const pair = owner.getByRole("button", { name: en.appPages.collar.empty.pair });
  await expect(pair).toBeVisible();
  await pair.click();
  // Step 1 says to switch the collar on; step 2 takes the sticker's code. This one is
  // well-formed and on no sticker, so the real collar (AMSM-1470) is never touched.
  await owner.getByRole("button", { name: en.appPages.collar.wizard.on.next }).click();
  await owner.getByLabel(en.appPages.collar.wizard.code.label).fill("ZZZZ9999");
  await owner.keyboard.press("Enter");
  await expect(owner.getByText(en.appPages.collar.wizard.code.notFound)).toBeVisible();
});

test("cleanup: the test sitter leaves the sitter list", async () => {
  await sitter.goto("/profile");
  await expect(sitter.getByLabel(en.appPages.profile.fullNameLabel)).toHaveValue(SITTER.name);
  await sitter.getByRole("button", { name: en.appPages.profile.tabSitterSettings }).click();
  const mode = sitter.getByRole("switch", { name: en.appPages.profile.sitterModeLabel });
  if ((await mode.getAttribute("aria-checked")) === "true") await mode.click();
  await sitter.getByRole("button", { name: en.appPages.profile.saveProfileButton }).click();
  await expect(sitter.getByText(en.appPages.profile.profileSavedMessage)).toBeVisible();
});
