import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as exportCsv } from "../app/api/admin/export/route";
import { GET as authGet, POST as authPost } from "../app/api/auth/[...nextauth]/route";
import sitemap from "../app/sitemap";

const f = vi.hoisted(() => ({
  viewer: vi.fn(),
  missingSettings: vi.fn(),
  authenticate: vi.fn(),
  audit: vi.fn(),
  event: vi.fn(),
  events: vi.fn(),
  participants: vi.fn(),
  projects: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getViewer: f.viewer,
  authOptions: {},
  missingAuthSettings: f.missingSettings,
}));
vi.mock("next-auth", () => ({ default: () => f.authenticate }));
vi.mock("@/lib/security/audit", () => ({ auditSecurityEvent: f.audit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    hackathon: { findUnique: f.event, findMany: f.events },
    participant: { findMany: f.participants },
    project: { findMany: f.projects },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  f.viewer.mockResolvedValue({ id: "organizer", isAdmin: true });
  f.event.mockResolvedValue({ slug: "build-week" });
});
afterEach(() => vi.unstubAllEnvs());

const requestCsv = (query: string) =>
  exportCsv(new NextRequest("https://example.org/api/admin/export?" + query));

describe("administrative CSV exports", () => {
  it.each([null, { id: "guest", isAdmin: false }])(
    "denies unauthorized viewers before reading the event",
    async (viewer) => {
      f.viewer.mockResolvedValue(viewer);
      const response = await requestCsv("hackathonId=event&type=participants");
      expect(response.status).toBe(403);
      expect(f.event).not.toHaveBeenCalled();
      expect(f.audit).toHaveBeenCalledWith({ event: "export.denied", actorId: viewer?.id });
    },
  );

  it.each(["type=participants", "hackathonId=event", "type=users&hackathonId=event"])(
    "rejects incomplete or unsupported requests (%s)",
    async (query) => {
      expect((await requestCsv(query)).status).toBe(400);
      expect(f.participants).not.toHaveBeenCalled();
    },
  );

  it("returns 404 for a missing event", async () => {
    f.event.mockResolvedValue(null);
    expect((await requestCsv("hackathonId=missing&type=votes")).status).toBe(404);
  });

  it("downloads a private, escaped participant list with registration and revocation status", async () => {
    f.participants.mockResolvedValue([
      {
        normalizedEmail: "a@example.org",
        name: " =1+1",
        team: { name: 'A "Team"' },
        userId: "a",
        revokedAt: null,
      },
      { normalizedEmail: "b@example.org", name: null, team: null, userId: null, revokedAt: new Date() },
    ]);
    const result = await requestCsv("hackathonId=event&type=participants");
    expect(result.headers.get("content-disposition")).toBe(
      'attachment; filename="build-week-participants.csv"',
    );
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect((await result.text()).split("\r\n")).toEqual([
      '"Email","Name","Team","Registered","Status"',
      '"a@example.org","\' =1+1","A ""Team""","Yes","Active"',
      '"b@example.org","","","No","Revoked"',
    ]);
    expect(f.audit).toHaveBeenCalledWith({
      event: "export.succeeded",
      actorId: "organizer",
      intent: "participants",
    });
  });

  it("exports vote counts only for projects with a publication date", async () => {
    f.projects.mockResolvedValue([
      { name: "Demo", team: { name: "Crew" }, status: "SUBMITTED", _count: { votes: 4 } },
    ]);
    const result = await requestCsv("type=votes&hackathonId=event");
    expect(f.projects).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hackathonId: "event", publishedAt: { not: null } } }),
    );
    expect(await result.text()).toContain('"Demo","Crew","SUBMITTED","4"');
  });
});

describe("authentication route", () => {
  it.each([authGet, authPost])(
    "returns service unavailable when authentication is unconfigured",
    async (handler) => {
      f.missingSettings.mockReturnValue(["GOOGLE_ID"]);
      const response = await handler(new NextRequest("https://example.org/api/auth/signin"), {
        params: Promise.resolve({ nextauth: ["signin"] }),
      });
      expect(response.status).toBe(503);
      expect(f.authenticate).not.toHaveBeenCalled();
    },
  );

  it("passes configured sign-in requests and route context to NextAuth", async () => {
    f.missingSettings.mockReturnValue([]);
    f.authenticate.mockResolvedValue(new Response("sign-in"));
    const request = new NextRequest("https://example.org/api/auth/signin");
    const context = { params: Promise.resolve({ nextauth: ["signin"] }) };
    expect(await (await authPost(request, context)).text()).toBe("sign-in");
    expect(f.authenticate).toHaveBeenCalledWith(request, context);
  });
});

describe("sitemap", () => {
  it("encodes public event and submitted project paths under the configured origin", async () => {
    vi.stubEnv("NEXTAUTH_URL", "https://community.example.org");
    const date = new Date("2026-01-02T00:00:00Z");
    f.events.mockResolvedValue([
      { slug: "my event", updatedAt: date, projects: [{ id: "a/b", updatedAt: date }] },
    ]);
    const entries = await sitemap();
    expect(entries.map((entry) => entry.url)).toEqual(
      [
        "/",
        "/hackathons",
        "/privacy",
        "/terms",
        "/hackathons/my%20event",
        "/hackathons/my%20event/projects/a%2Fb",
      ].map((path) => "https://community.example.org" + path),
    );
    expect(entries.at(-1)?.lastModified).toEqual(date);
    expect(f.events).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: "DRAFT" } },
        select: expect.objectContaining({
          projects: expect.objectContaining({ where: { status: "SUBMITTED" } }),
        }),
      }),
    );
  });

  it("serves static pages on the default origin with no events", async () => {
    vi.stubEnv("NEXTAUTH_URL", undefined);
    f.events.mockResolvedValue([]);
    expect((await sitemap())[0].url).toBe("https://stripe-hackathon-singapore.vercel.app/");
  });
});
