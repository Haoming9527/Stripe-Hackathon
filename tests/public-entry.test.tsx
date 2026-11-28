import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import Home from "../app/page";
import Portal from "../app/hackathons/[slug]/portal/page";

const f = vi.hoisted(() => ({
  featured: vi.fn(),
  member: vi.fn(),
  viewer: vi.fn(),
  settings: vi.fn(),
  portal: vi.fn(),
}));
vi.mock("@/lib/queries", () => ({ findFeaturedEvent: f.featured, findParticipant: f.member }));
vi.mock("next/cache", () => ({
  unstable_cache: (read: () => Promise<unknown>) => async () => JSON.parse(JSON.stringify(await read())),
}));
vi.mock("@/lib/auth", () => ({ getViewer: f.viewer, missingAuthSettings: f.settings }));
vi.mock("@/components/portal/data", () => ({ loadPortal: f.portal }));
vi.mock("@/components/portal/PortalHeader", () => ({
  PortalHeader: ({ adminPreview }: { adminPreview: boolean }) => (
    <header>{adminPreview ? "Admin preview" : "Participant portal"}</header>
  ),
}));
vi.mock("@/components/portal/OverviewTab", () => ({ OverviewTab: () => <h2>Overview</h2> }));
vi.mock("@/components/portal/TeamTab", () => ({ TeamTab: () => <h2>Team</h2> }));
vi.mock("@/components/portal/SubmissionTab", () => ({ SubmissionTab: () => <h2>Submission</h2> }));
vi.mock("@/components/portal/CreditsTab", () => ({ CreditsTab: () => <h2>Credits</h2> }));

const event = {
  id: "e",
  slug: "build",
  title: "Build Week",
  status: "ACTIVE",
  startsAt: new Date(),
  timezone: "UTC",
  location: "Online",
};
const viewer = { id: "u", email: "u@example.org", isAdmin: false };
const home = async (query: Record<string, string | string[]> = {}) =>
  renderToStaticMarkup(await Home({ searchParams: Promise.resolve(query) }));
const portal = async (tab?: string) =>
  renderToStaticMarkup(
    await Portal({
      params: Promise.resolve({ slug: event.slug }),
      searchParams: Promise.resolve({ tab }),
    }),
  );

beforeEach(() => {
  vi.resetAllMocks();
  f.featured.mockResolvedValue(event);
  f.settings.mockReturnValue([]);
  f.member.mockResolvedValue(null);
  f.viewer.mockResolvedValue(null);
});

it("shows the featured event and a Google sign-in button for guests", async () => {
  const html = await home();
  expect(html).toContain("Build Week");
  expect(html).toContain('Organized by the <a href="https://www.stripecommunity.com/public/clubs/singapore-r40ia">Singapore Stripe Community</a>');
  expect(html.indexOf("Organized by")).toBeLessThan(html.indexOf("Sign in with Google"));
  expect(html).toContain(`dateTime="${event.startsAt.toISOString()}"`);
  expect(html).toContain("Sign in with Google");
  expect(f.member).not.toHaveBeenCalled();
});

it("renders a usable fallback when event lookup or authentication configuration is unavailable", async () => {
  f.featured.mockRejectedValue(new Error("temporarily unavailable"));
  f.settings.mockReturnValue(["GOOGLE_ID"]);
  const html = await home({ callbackUrl: ["ignored"], error: "UnverifiedEmail" });
  expect(html).toContain("Singapore hackathons");
  expect(html).toContain("must verify your email");
  expect(html).toContain("temporarily unavailable");
  expect(html).toContain("disabled");
  expect(await home({ error: "Unknown" })).toContain("Sign-in could not be completed");
});

it("selects the gallery, portal or administration link for the current account", async () => {
  f.viewer.mockResolvedValue(viewer);
  const gallery = await home();
  expect(gallery).toContain('href="/hackathons/build"');
  expect(gallery).toContain("Explore hackathons");
  f.member.mockResolvedValue({ id: "member" });
  const member = await home();
  expect(member).toContain('href="/hackathons/build/portal"');
  expect(member).toContain("Open your portal");
  f.viewer.mockResolvedValue({ ...viewer, isAdmin: true });
  expect(await home({ callbackUrl: "https://example.net/elsewhere" })).toContain('href="/admin"');
  expect(await home({ callbackUrl: "/join/build/link" })).toContain('href="/join/build/link"');
});

it("directs a nonparticipant to the public gallery with the current account email", async () => {
  f.portal.mockResolvedValue({ event, viewer, access: false });
  const html = await portal("team");
  expect(html).toContain("Participant access required");
  expect(html).toContain(viewer.email);
  expect(html).toContain('href="/hackathons/build"');
  expect(f.portal).toHaveBeenCalledWith("build", "team");
});

it.each([
  ["overview", "Overview"],
  ["team", "Team"],
  ["submission", "Submission"],
  ["credits", "Credits"],
])("renders only the requested %s tab", async (tab, title) => {
  f.portal.mockResolvedValue({
    viewer,
    event,
    tab,
    access: true,
    participant: { id: "member" },
    invitations: [],
    hasCreditOffers: true,
  });
  const html = await portal(tab);
  expect(html).toContain("<h2>" + title + "</h2>");
  expect(html.match(/<h2>/g)).toHaveLength(1);
  expect(html).not.toContain("previewing");
});

it("informs administrators without participant records that they are previewing", async () => {
  f.portal.mockResolvedValue({
    viewer: { ...viewer, isAdmin: true },
    event,
    access: true,
    participant: null,
    tab: "overview",
    invitations: [{}],
  });
  const html = await portal();
  expect(html).toContain("Admin preview");
  expect(html).toContain("previewing this portal as an administrator");
});
