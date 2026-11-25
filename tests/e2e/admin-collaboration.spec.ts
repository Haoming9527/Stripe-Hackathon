import { expect, test } from "@playwright/test";
import { authenticate, eventId } from "./fixtures";

test("admin sessions receive live changes and preserve an open draft", async ({
  page,
  browser,
}) => {
  const other = await browser.newContext();
  try {
    await Promise.all([
      authenticate(page.context(), "ADMIN"),
      authenticate(other, "ADMIN"),
    ]);
    const second = await other.newPage();
    const url = new URL(
      `/admin/${eventId}?tab=settings`,
      process.env.E2E_BASE_URL,
    ).href;
    await Promise.all([page.goto(url), second.goto(url)]);
    await second.bringToFront();
    await second.getByRole("button", { name: /Add prize/ }).click();
    await second.getByLabel("Prize name 2", { exact: true })
      .fill("Draft from second organizer");
    await page.bringToFront();
    await page.getByLabel("Location", { exact: true }).fill("Community room");
    await expect(page.getByLabel("Location", { exact: true })).toHaveValue("Community room");
    await page.getByRole("button", { name: "Save event" }).click();
    await expect(
      page.getByText("Hackathon saved.", { exact: true }),
    ).toBeVisible();
    await second.bringToFront();
    await expect(
      second.getByText(/Another organizer saved changes/),
    ).toBeVisible();
    await expect(
      second.getByLabel("Prize name 2", { exact: true }),
    ).toHaveValue("Draft from second organizer");
    await second.getByRole("button", { name: "Save event" }).click();
    await expect(second.getByLabel("Location", { exact: true })).toHaveValue(
      "Community room",
    );
    await page.bringToFront();
    await expect(
      page.getByLabel("Prize name 2", { exact: true }),
    ).toHaveValue("Draft from second organizer");
  } finally {
    await other.close();
  }
});
