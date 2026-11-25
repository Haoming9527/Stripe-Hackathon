import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import InvitationPage from "../app/join/[eventId]/[token]/page";

const f = vi.hoisted(() => ({
  tokenValid: vi.fn(),
  viewer: vi.fn(),
  event: vi.fn(),
  join: vi.fn(),
  refresh: vi.fn(),
  missingSettings: vi.fn(),
  form: vi.fn<(props: { action: () => Promise<void>; afterSignIn: boolean }) => void>(),
}));
vi.mock("next/cache", () => ({ revalidatePath: f.refresh }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (path: string) => {
    throw new Error("redirect " + path);
  },
}));
vi.mock("@/lib/db", () => ({ prisma: { hackathon: { findUnique: f.event } } }));
vi.mock("@/lib/auth", () => ({ getViewer: f.viewer, missingAuthSettings: f.missingSettings }));
vi.mock("@/lib/domain/participants", () => ({ joinInvitedHackathon: f.join }));
vi.mock("@/lib/participant-invite", () => ({
  validParticipantInvite: f.tokenValid,
  participantInvitePath: (id: string) => "/join/" + id + "/invite",
}));
vi.mock("../app/join/[eventId]/[token]/JoinForm", () => ({
  JoinForm: (props: Parameters<typeof f.form>[0]) => {
    f.form(props);
    return <button>Join hackathon</button>;
  },
}));
vi.mock("@/components/GoogleSignInButton", () => ({
  GoogleSignInButton: ({ callbackUrl, children }: React.PropsWithChildren<{ callbackUrl: string }>) => (
    <button data-callback={callbackUrl}>{children}</button>
  ),
}));

const event = {
  title: "Build Week",
  status: "ACTIVE",
  timezone: "Asia/Singapore",
  location: "Online",
  startsAt: new Date("2026-03-01"),
};
const account = { id: "u", name: "Builder", email: "u@example.org", image: null };
const page = async (query: { signedIn?: string; denied?: string } = {}) =>
  renderToStaticMarkup(
    await InvitationPage({
      params: Promise.resolve({ eventId: "event", token: "invite" }),
      searchParams: Promise.resolve(query),
    }),
  );

beforeEach(() => {
  vi.resetAllMocks();
  f.tokenValid.mockReturnValue(true);
  f.event.mockResolvedValue(event);
  f.viewer.mockResolvedValue(null);
  f.missingSettings.mockReturnValue([]);
});

it("validates the invite before fetching the event and returns not found for a deleted event", async () => {
  f.tokenValid.mockReturnValueOnce(false);
  await expect(page()).rejects.toThrow();
  expect(f.event).not.toHaveBeenCalled();
  f.event.mockResolvedValue(null);
  await expect(page()).rejects.toThrow();
});

it("returns guests to the same invitation after Google sign-in", async () => {
  const html = await page();
  expect(html).toContain("Build Week");
  expect(html).toContain('data-callback="/join/event/invite?signedIn=1"');
  expect(html).toContain("Sign in with Google to join");
});

it("explains disabled sign-in, rejected joins, and closed events", async () => {
  f.missingSettings.mockReturnValue(["GOOGLE_ID"]);
  expect(await page()).toContain("temporarily unavailable");
  expect(await page({ denied: "1" })).toContain("Contact the organizer");
  f.event.mockResolvedValue({ ...event, status: "ENDED", location: null });
  expect(await page()).toContain("not currently accepting participants");
  expect(f.form).not.toHaveBeenCalled();
});

it("enrolls the signed-in account once, refreshes the admin participant list, and opens the portal", async () => {
  f.viewer.mockResolvedValue(account);
  f.join.mockResolvedValue("build-week");
  expect(await page({ signedIn: "1" })).toContain(account.email);
  const [{ action, afterSignIn }] = f.form.mock.calls[0];
  expect(afterSignIn).toBe(true);
  await expect(action()).rejects.toThrow("redirect /hackathons/build-week/portal");
  expect(f.join).toHaveBeenCalledExactlyOnceWith("event", account);
  expect(f.refresh).toHaveBeenCalledWith("/admin/event");
});

it("checks the token and current identity again when the join action runs", async () => {
  f.viewer.mockResolvedValue(account);
  await page();
  const [{ action, afterSignIn }] = f.form.mock.calls[0];
  expect(afterSignIn).toBe(false);
  f.tokenValid.mockReturnValueOnce(false);
  await expect(action()).rejects.toThrow();
  f.viewer.mockResolvedValueOnce(null);
  await expect(action()).rejects.toThrow("redirect /join/event/invite");
  expect(f.join).not.toHaveBeenCalled();
  f.join.mockResolvedValue(null);
  await expect(action()).rejects.toThrow("redirect /join/event/invite?denied=1");
  expect(f.refresh).not.toHaveBeenCalled();
});
