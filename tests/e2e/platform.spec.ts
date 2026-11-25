import { expect, test, type Page } from "@playwright/test";
import { authenticate, eventId, eventSlug, existingProjectId, privateBriefing, privateCredit } from "./fixtures";

async function captureFullPage(page: Page, path: string) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path, fullPage: true });
}

test("guests browse galleries without private data and mobile pages stay within the viewport", async ({ page, request }) => {
  const entryResponse = await page.goto("/");
  expect(entryResponse!.headers()["x-frame-options"]).toBe("DENY");
  expect(entryResponse!.headers()["x-content-type-options"]).toBe("nosniff");
  expect(entryResponse!.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(entryResponse!.headers()["x-powered-by"]).toBeUndefined();
  await expect(page.getByRole("heading", { level: 1, name: "Community browser test" })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Singapore community" })).toHaveAttribute("href", "https://www.stripecommunity.com/public/clubs/singapore-r40ia");
  const footer = page.getByRole("contentinfo");
  const githubLink = footer.getByRole("link", { name: "Star on GitHub" });
  await expect(githubLink.locator("svg")).toBeVisible();
  await expect(footer.getByRole("link", { name: "Developer resources" })).toHaveCount(0);
  await expect(footer).toHaveCSS("border-top-width", "0px");
  expect(await githubLink.evaluate(link => document.documentElement.clientWidth - link.getBoundingClientRect().right)).toBeLessThanOrEqual(20);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
  const galleryLink = page.getByRole("link", { name: "Browse the public galleries", exact: true });
  await expect(galleryLink).toHaveAttribute("href", "/hackathons");
  await expect(page.getByRole("button", { name: "Sign in with Google", exact: true })).toBeVisible();
  const navbar = page.getByRole("banner").locator(".header-inner");
  const signIn = navbar.getByRole("button", { name: "Sign in", exact: true });
  await page.mouse.move(5, 180);
  await expect(navbar).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await signIn.hover();
  await expect(navbar).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(signIn).toHaveCSS("border-top-color", "rgb(99, 91, 255)");
  await signIn.focus();
  await page.mouse.move(5, 180);
  await expect(navbar).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(signIn).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await signIn.blur();
  await expect(page.getByRole("button", { name: "Continue with Stripe", exact: true })).toHaveCount(0);
  const providers = await request.get("/api/auth/providers");
  expect(Object.keys(await providers.json())).toEqual(["google"]);
  await captureFullPage(page, "artifacts/home-desktop.png");
  await galleryLink.click();
  await expect(page).toHaveURL("/hackathons");
  await page.getByRole("link", { name: /Community browser test/ }).click();
  await expect(page).toHaveURL(`/hackathons/${eventSlug}`);
  await expect(page.getByRole("heading", { level: 1, name: "Community browser test" })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 250, behavior: "instant" }));
  await expect(page.getByRole("banner")).not.toBeInViewport();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Star on GitHub" })).toHaveAttribute("href", "https://github.com/Haoming9527/Stripe-Hackathon");
  await expect(page.getByRole("link", { name: "Seeded public project", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to vote" }).first()).toBeVisible();
  await expect(page.getByText("Unpublished private draft", { exact: true })).toHaveCount(0);
  const response = await request.get(`/hackathons/${eventSlug}`);
  const html = await response.text();
  for (const value of [privateBriefing, privateCredit, "builder@example.com", "voteCount", '"votes":']) expect(html).not.toContain(value);
  await captureFullPage(page, "artifacts/gallery-desktop.png");

  await page.getByLabel("Search projects").fill("no-matching-project");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No projects match your search." })).toBeVisible();
  await page.getByRole("link", { name: "View all projects", exact: true }).click();
  await page.getByRole("link", { name: "Seeded public project", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Seeded public project" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Watch video", exact: true })).toHaveAttribute("href", /youtube/);

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/login", `/hackathons/${eventSlug}`, `/hackathons/${eventSlug}/projects/${existingProjectId}`]) {
    await page.goto(path);
    const expectedHeading = path.includes("/projects/") ? "Seeded public project" : "Community browser test";
    await expect(page.getByRole("heading", { level: 1, name: expectedHeading })).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    if (path === "/" || path === "/login") {
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
    }
    const name = path === "/login" ? "login" : path === "/" ? "home" : path.includes("/projects/") ? "project" : "gallery";
    await captureFullPage(page, `artifacts/${name}-mobile.png`);
  }
  await page.goto(`/hackathons/${eventSlug}/portal`);
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  const exported = await request.get(`/api/admin/export?hackathonId=${eventId}&type=votes`);
  expect(exported.status()).toBe(403);
});

const eventGallery = `/hackathons/${eventSlug}`;
const filteredGallery = `${eventGallery}?q=Seeded+public&track=e2e-track&page=1#projects`;
for (const { source, button, expectedReturn, start } of [
  { source: "filtered gallery voting", button: "Sign in to vote", start: filteredGallery, expectedReturn: filteredGallery },
  { source: "project details voting", button: "Sign in to vote", start: `${eventGallery}/projects/${existingProjectId}`, expectedReturn: eventGallery },
  { source: "participant access", button: "Participant sign in with Google", start: eventGallery, expectedReturn: `${eventGallery}/portal` },
]) {
  test(`${source} opens Google with the correct return URL`, async ({ page }) => {
    const google = "https://accounts.google.com/o/oauth2/v2/auth";
    await page.route("**/api/auth/signin/google*", route => route.fulfill({ json: { url: google } }));
    await page.route(google, route => route.fulfill({ contentType: "text/html", body: "" }));
    await page.goto(start);

    const [request] = await Promise.all([
      page.waitForRequest(req => req.method() === "POST" && new URL(req.url()).pathname === "/api/auth/signin/google"),
      page.getByRole("button", { name: button, exact: true }).first().click(),
    ]);
    const callback = new URLSearchParams(request.postData() ?? "").get("callbackUrl");
    expect(callback).toBeTruthy();
    expect(new URL(callback!, request.url()).href).toBe(new URL(expectedReturn, request.url()).href);
    await expect(page).toHaveURL(google);
  });
}

test("participants form teams, invite teammates, save a private draft, and publish with consent", async ({ page, context, browser }) => {
  test.setTimeout(90_000);
  await authenticate(context, "BUILDER");
  await page.goto(`/hackathons/${eventSlug}/portal?tab=team`);
  await page.getByLabel("Team name", { exact: true }).fill("Browser builders");
  await expect.poll(() => page.getByLabel("Team name", { exact: true }).evaluate(input => {
    const button = input.closest("form")!.querySelector('button[type="submit"]')!;
    return button.getBoundingClientRect().top - input.getBoundingClientRect().bottom;
  })).toBeGreaterThanOrEqual(18);
  await page.getByRole("button", { name: "Create team", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Browser builders", exact: true })).toBeVisible();
  await page.getByLabel("Email address", { exact: true }).fill("teammate@example.com");
  await page.getByRole("button", { name: "Send invitation", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Invitation saved in the portal" })).toBeVisible();

  const teammateContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  try {
    await authenticate(teammateContext, "TEAMMATE");
    const teammatePage = await teammateContext.newPage();
    await teammatePage.goto(`/hackathons/${eventSlug}/portal?tab=team`);
    await teammatePage.getByRole("button", { name: "Accept invitation", exact: true }).click();
    await expect(teammatePage.getByRole("heading", { name: "Browser builders", exact: true })).toBeVisible();
  } finally {
    await teammateContext.close();
  }

  const organizerContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  try {
    await authenticate(organizerContext, "ADMIN");
    const organizer = await organizerContext.newPage();
    await organizer.goto(`/admin/${eventId}?tab=participants`);
    const teammate = organizer.getByRole("row").filter({ hasText: "teammate@example.com" });
    await teammate.getByText("Edit participant", { exact: true }).click();
    await teammate.getByRole("checkbox").check();
    await teammate.getByRole("button", { name: "Remove participant", exact: true }).click();
    await expect(teammate).toContainText("Revoked");
    await page.reload();
    const reservedSeat = page.locator(".member-row").filter({ hasText: "teammate@example.com" });
    await expect(reservedSeat).toContainText("Access revoked");
    await expect(reservedSeat.getByRole("button", { name: "Remove", exact: true })).toBeVisible();
    await expect(page.getByText("2 / 2 members", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send invitation", exact: true })).toBeDisabled();
    await teammate.getByRole("button", { name: "Restore participant", exact: true }).click();
    await expect(teammate.getByRole("button", { name: "Remove participant", exact: true })).toBeVisible();
  } finally {
    await organizerContext.close();
  }

  await page.goto(`/hackathons/${eventSlug}/portal?tab=submission`);
  await page.getByLabel("Project name", { exact: false }).fill("A project from the browser");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  const secondTab = await context.newPage();
  await secondTab.goto(page.url());
  await secondTab.getByLabel("Project name", { exact: false }).fill("Older draft title");
  const beforePublishing = await page.request.get(`/hackathons/${eventSlug}`);
  expect(await beforePublishing.text()).not.toContain("A project from the browser");
  await page.locator('textarea[name="description"]').fill("A working project created through the participant portal and verified in a real browser.");
  await page.locator('input[name="videoUrl"]').fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.locator('input[name="githubUrl"]').fill("https://github.com/community/browser-project");
  await page.getByRole("checkbox", { name: "Commerce", exact: false }).check();
  await page.getByRole("button", { name: "Submit and publish", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /agree|consent/i })).toBeVisible();
  await expect(page.locator('textarea[name="description"]')).toHaveValue("A working project created through the participant portal and verified in a real browser.");
  await expect(page.locator('input[name="videoUrl"]')).toHaveValue("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await expect(page.getByRole("checkbox", { name: "Commerce", exact: false })).toBeChecked();
  await page.getByRole("checkbox", { name: /I agree to publish/ }).check();
  await page.getByRole("button", { name: "Submit and publish", exact: true }).click();
  await expect(page.getByText("Published in gallery", { exact: true })).toBeVisible();
  await secondTab.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(secondTab.getByRole("alert").filter({ hasText: "changed since you opened" })).toBeVisible();
  await expect(secondTab.getByLabel("Project name", { exact: false })).toHaveValue("Older draft title");
  await secondTab.close();
  await page.bringToFront();
  await expect(page.getByText("Share your project", { exact: true })).toHaveCount(0);
  const publicLink = page.getByRole("link", { name: "View your project", exact: true });
  await expect(publicLink).toBeVisible();
  const projectHref = await publicLink.getAttribute("href");
  const publicResponse = await page.request.get(projectHref!);
  expect(publicResponse.status()).toBe(200);
  await captureFullPage(page, "artifacts/portal-project-desktop.png");

  await page.goto(`/hackathons/${eventSlug}/portal?tab=team`);
  await expect(page.getByText("Your roster is locked because your project has been published.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send invitation", exact: true })).toHaveCount(0);
  await page.goto(`/hackathons/${eventSlug}`);
  const ownProject = page.getByRole("article").filter({ has: page.getByRole("link", { name: "A project from the browser", exact: true }) });
  await expect(ownProject).toContainText(/Your team.s project/);
  await expect(ownProject.getByRole("button", { name: "Vote for project" })).toHaveCount(0);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await ownProject.getByRole("button", { name: "Copy project link", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(new URL(projectHref!, page.url()).href);
});

test("participants can reveal only their assigned credit", async ({ page, context, browser }) => {
  await authenticate(context, "BUILDER");
  await page.goto(`/hackathons/${eventSlug}/portal?tab=credits`);
  await expect(page.getByText(privateCredit, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Claim your credit", exact: true }).click();
  await expect(page.locator("code").filter({ hasText: privateCredit })).toBeVisible();
  await page.reload();
  await expect(page.locator("code").filter({ hasText: privateCredit })).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim your credit", exact: true })).toHaveCount(0);
  await captureFullPage(page, "artifacts/portal-credits-desktop.png");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await captureFullPage(page, "artifacts/portal-credits-mobile.png");

  const otherContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  try {
    await authenticate(otherContext, "TEAMMATE");
    const other = await otherContext.newPage();
    const response = await other.goto(`/hackathons/${eventSlug}/portal?tab=credits`);
    expect(await response!.text()).not.toContain(privateCredit);
    await expect(other.getByText("Not assigned yet", { exact: true })).toBeVisible();
  } finally { await otherContext.close(); }
});

test("signed-in visitors vote and undo within the same allowance without participant or admin access", async ({ page, context }) => {
  await authenticate(context, "VISITOR");
  await page.goto(`/hackathons/${eventSlug}`);
  await expect(page.getByText("1 of 1 votes remaining", { exact: true })).toBeVisible();
  const project = page.getByRole("article").filter({ has: page.getByRole("link", { name: "Seeded public project", exact: true }) });
  const detail = await context.newPage();
  await detail.goto(`/hackathons/${eventSlug}/projects/${existingProjectId}`);
  const voteButton = detail.getByRole("button", { name: "Vote for project", exact: true });
  await expect(voteButton).toBeVisible();
  await project.getByRole("button", { name: "Vote for project", exact: true }).click();
  await expect(page.getByText("0 of 1 votes remaining", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "All votes used", exact: true }).first()).toBeDisabled();
  await voteButton.click();
  const undoButton = detail.getByRole("button", { name: /Voted.*undo/ });
  await expect(undoButton).toBeVisible();
  await project.getByRole("button", { name: /Voted.*undo/ }).click();
  await expect(page.getByText("1 of 1 votes remaining", { exact: true })).toBeVisible();
  await undoButton.click();
  await expect(voteButton).toBeVisible();
  await detail.close();
  await page.goto(`/hackathons/${eventSlug}/portal`);
  await expect(page.getByRole("heading", { name: "Participant access required" })).toBeVisible();
  await expect(page.getByText(privateBriefing)).toHaveCount(0);
  const exported = await page.request.get(`/api/admin/export?hackathonId=${eventId}&type=votes`);
  expect(exported.status()).toBe(403);
});

test("admins create and edit events, preview imports, and allocate unique credit inventory", async ({ page, context }) => {
  test.setTimeout(90_000);
  await authenticate(context, "ADMIN");
  await page.goto(`/admin/${eventId}?tab=projects`);
  await expect(page.getByRole("heading", { name: "Projects and voting results" })).toBeVisible();
  const adminSidebar = page.getByRole("complementary").filter({ has: page.getByRole("navigation", { name: "Admin navigation" }) });
  await expect(adminSidebar.getByRole("link")).toHaveCount(3);
  await expect(adminSidebar.getByRole("link", { name: "Community site" })).toHaveAttribute("href", "https://www.stripecommunity.com/public/clubs/singapore-r40ia");
  await expect(page.getByRole("link", { name: "Stripe Community Hackathons home", exact: true })).toHaveCSS("color", "rgb(10, 37, 64)");
  await captureFullPage(page, "artifacts/admin-desktop.png");
  await page.goto("/admin/new");
  await page.getByLabel("Hackathon name", { exact: true }).fill("Browser-created hackathon");
  await page.getByLabel("Page URL", { exact: false }).fill("browser-created-hackathon");
  await page.getByRole("combobox", { name: "Visibility", exact: true }).selectOption("ACTIVE");
  await page.getByLabel("Event timezone", { exact: false }).fill("UTC");
  const earlier = new Date(Date.now() - 3_600_000).toISOString().slice(0, 16);
  const later = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
  for (const name of ["startsAt", "submissionOpensAt", "votingOpensAt"]) await page.locator(`input[name="${name}"]`).fill(earlier);
  for (const name of ["endsAt", "submissionClosesAt", "votingClosesAt"]) await page.locator(`input[name="${name}"]`).fill(later);
  await page.getByRole("button", { name: "Create hackathon", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Browser-created hackathon" })).toBeVisible();
  const eventPath = new URL(page.url()).pathname;
  expect(eventPath).not.toBe("/admin/new");

  await page.goto(`${eventPath}?tab=settings`);
  await page.getByRole("button", { name: /Add track/ }).click();
  await page.getByLabel("Track name 1", { exact: true }).fill("Commerce");
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Hackathon saved." })).toBeVisible();
  const tracks = page.locator('input[name="tracks"]');
  await expect(tracks).toHaveValue(/"id":"[^"]+"/);
  const savedTracks = await tracks.inputValue();
  await page.getByLabel("Short introduction", { exact: false }).fill("Created and edited through the browser.");
  await page.getByLabel("Location", { exact: true }).fill("Browser test venue");
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(page.getByText(/Browser test venue ·/)).toBeVisible();
  await page.reload();
  await expect(tracks).toHaveValue(savedTracks);
  await expect(page.getByLabel("Short introduction", { exact: false })).toHaveValue("Created and edited through the browser.");

  await page.goto(`${eventPath}?tab=participants`);
  await page.getByRole("textbox", { name: /^Or paste email addresses/ }).fill("first@example.com\nnot-an-email");
  await expect(page.getByRole("button", { name: "Import participants", exact: true })).toBeDisabled();
  await expect(page.getByRole("alert").filter({ hasText: "invalid address" })).toBeVisible();
  await page.getByRole("textbox", { name: /^Or paste email addresses/ }).fill("email,name\nfirst@example.com,First\n,Second");
  await expect(page.getByRole("alert").filter({ hasText: "Missing email in CSV record 3" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import participants", exact: true })).toBeDisabled();
  await page.getByRole("textbox", { name: /^Or paste email addresses/ }).fill("first@example.com\nFIRST@example.com\nsecond@example.com");
  await expect(page.getByText(/duplicates ignored/)).toContainText("1");
  await page.getByRole("button", { name: "Import participants", exact: true }).click();
  await expect(page.locator("table")).toContainText("first@example.com");
  await expect(page.locator("table")).toContainText("second@example.com");

  const addParticipant = page.locator("section").filter({ has: page.getByRole("heading", { name: "Add a participant", exact: true }) });
  await addParticipant.getByLabel("Name (optional)").fill("Test participant");
  await addParticipant.getByLabel("Email address", { exact: true }).fill("third@example.com");
  await addParticipant.getByRole("button", { name: "Add participant", exact: true }).click();
  const participantRow = page.getByRole("row").filter({ hasText: "third@example.com" });
  await participantRow.getByText("Edit participant", { exact: true }).click();
  await participantRow.getByLabel("Name (optional)").fill("Updated participant");
  await participantRow.getByRole("button", { name: "Save participant" }).click();
  await expect(participantRow.locator("strong").first()).toHaveText("Updated participant");
  await participantRow.getByRole("checkbox").check();
  await participantRow.getByRole("button", { name: "Remove participant", exact: true }).click();
  await expect(participantRow).toContainText("Revoked");
  await participantRow.getByRole("button", { name: "Restore participant" }).click();
  await expect(participantRow).toContainText("Invited");
  await participantRow.getByRole("checkbox").check();
  await participantRow.getByRole("button", { name: "Remove participant", exact: true }).click();
  await expect(participantRow).toContainText("Revoked");

  await page.goto(`${eventPath}?tab=credits`);
  await page.getByLabel("Offer name", { exact: true }).fill("Browser API credits");
  await page.getByRole("button", { name: "Create credit offer", exact: true }).click();
  const offer = page.locator("section").filter({ has: page.getByRole("heading", { name: "Browser API credits", exact: true }) });
  await expect(offer.getByRole("button", { name: "Assign 2 vouchers", exact: true })).toBeDisabled();
  await expect(offer).toContainText("Add 2 more vouchers");
  const chooserReady = page.waitForEvent("filechooser");
  await offer.getByRole("button", { name: "Upload CSV or TXT", exact: true }).click();
  const chooser = await chooserReady;
  await chooser.setFiles({ name: "credits.csv", mimeType: "text/csv", buffer: Buffer.from("code\nBROWSER-CODE-ONE\nBROWSER-CODE-TWO") });
  await expect(offer.getByRole("status").filter({ hasText: "Loaded credits.csv" })).toBeVisible();
  await expect(offer.getByLabel("Unique codes or redemption links", { exact: false })).toHaveValue("code\nBROWSER-CODE-ONE\nBROWSER-CODE-TWO");
  await offer.screenshot({
    path: "artifacts/credit-import-desktop.png",
  });
  await offer.getByRole("button", { name: "Add to inventory", exact: true }).click();
  await expect(offer.getByRole("button", { name: "Assign 2 vouchers", exact: true })).toBeEnabled();
  await offer.getByRole("button", { name: "Assign 2 vouchers", exact: true }).click();
  await expect(offer.getByText("Allocation history (2)", { exact: true })).toBeVisible();
  await expect(offer.getByRole("button", { name: "Assign vouchers", exact: true })).toBeDisabled();

  await page.goto(`${eventPath}?tab=overview`);
  await page.getByRole("combobox", { name: "Event status", exact: true }).selectOption("ENDED");
  await page.getByRole("button", { name: "Update status", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /ended|updated|status/i })).toBeVisible();
  await page.goto("/hackathons/browser-created-hackathon");
  await expect(page.getByRole("heading", { level: 1, name: "Browser-created hackathon" })).toBeVisible();
  await expect(page.getByText("Voting is closed", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Hackathons" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await captureFullPage(page, "artifacts/admin-mobile.png");
  await page.goto(`${eventPath}?tab=settings`);
  await page.getByLabel("Type browser-created-hackathon to confirm", { exact: true }).fill("browser-created-hackathon");
  await page.getByRole("button", { name: "Delete hackathon permanently" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: "Browser-created hackathon", exact: true })).toHaveCount(0);
});
