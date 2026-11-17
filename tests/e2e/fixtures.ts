import type { BrowserContext } from "@playwright/test";

export const eventSlug = "test-community-build";
export const eventId = "e2e-event";
export const existingProjectId = "e2e-project";
export const privateCredit = "E2E-BUILDER-CREDIT-PRIVATE";
export const privateBriefing = "PRIVATE_ATTENDEE_TOKEN_e2e";

export async function authenticate(context: BrowserContext, person: "ADMIN" | "BUILDER" | "TEAMMATE" | "VISITOR") {
  const token = process.env[`E2E_${person}_SESSION`];
  if (!token) throw new Error("Run this suite through npm run test:e2e so isolated fixture sessions are created.");
  await context.addCookies([{
    name: "next-auth.session-token",
    value: token,
    url: process.env.E2E_BASE_URL || "http://localhost:3101",
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  }]);
}
