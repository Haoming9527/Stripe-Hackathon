import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import Index from "../app/hackathons/page";
import Gallery from "../app/hackathons/[slug]/page";
import Project from "../app/hackathons/[slug]/projects/[projectId]/page";

const f = vi.hoisted(() => ({
  list: vi.fn(),
  event: vi.fn(),
  member: vi.fn(),
  viewer: vi.fn(),
  votes: vi.fn(),
  projects: vi.fn(),
  project: vi.fn(),
  count: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    project: { findMany: f.projects, findFirst: f.project, count: f.count },
    vote: { findMany: f.votes },
  },
}));
vi.mock("@/lib/queries", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/queries")>(),
  listPublicEvents: f.list,
  findPublicEvent: f.event,
  findParticipant: f.member,
}));
vi.mock("@/lib/auth", () => ({ getViewer: f.viewer, missingAuthSettings: () => [] }));
vi.mock("next/cache", () => ({ unstable_cache: (read: () => Promise<unknown>) => read }));
vi.mock("@/components/ActionForm", () => ({
  ActionForm: ({ children }: React.PropsWithChildren) => <form>{children}</form>,
}));
vi.mock("@/components/ProjectCard", () => ({
  ProjectCard: ({ project, vote }: { project: { name: string }; vote: { own: boolean } }) => (
    <article data-own={vote.own}>{project.name}</article>
  ),
  ProjectVote: ({ state }: { state: { own: boolean; voted: boolean; remaining: number } }) => (
    <output>{JSON.stringify(state)}</output>
  ),
}));

const event = {
  id: "evt",
  slug: "build",
  title: "Community Build",
  status: "ACTIVE",
  tagline: "Make something",
  startsAt: new Date("2026-02-01"),
  timezone: "Asia/Singapore",
  location: "Singapore",
  votingClosed: false,
  votingOpensAt: new Date(0),
  votingClosesAt: new Date("2100-02-01"),
  votesPerUser: 2,
  tracks: [{ id: "web", name: "Web" }],
  _count: { projects: 1 },
};
const project = {
  id: "p",
  name: "Project Alpha",
  description: "A prototype",
  team: { name: "Orbit" },
  videoUrl: "https://example.org/video",
  githubUrl: "https://github.com/example/alpha",
  demoUrl: "https://example.org/demo",
  tracks: [{ track: event.tracks[0] }],
};
const viewer = { id: "u", email: "u@example.org", isAdmin: false };
const gallery = async (filter: { q?: string; track?: string; page?: string } = {}) =>
  renderToStaticMarkup(
    await Gallery({ params: Promise.resolve({ slug: "build" }), searchParams: Promise.resolve(filter) }),
  );
const detail = async () =>
  renderToStaticMarkup(await Project({ params: Promise.resolve({ slug: "build", projectId: "p" }) }));

beforeEach(() => {
  vi.resetAllMocks();
  f.event.mockResolvedValue(event);
  f.viewer.mockResolvedValue(null);
  f.member.mockResolvedValue(null);
  f.projects.mockResolvedValue([]);
  f.project.mockResolvedValue({ ...project, hackathon: event });
  f.count.mockResolvedValue(0);
  f.votes.mockResolvedValue([]);
});

it("renders the empty directory and links to active and ended events with project counts", async () => {
  f.list
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      event,
      {
        ...event,
        id: "old",
        slug: "old",
        status: "ENDED",
        location: null,
        tagline: null,
        _count: { projects: 3 },
      },
    ]);
  expect(renderToStaticMarkup(await Index())).toContain("No hackathons have been published yet");
  const html = renderToStaticMarkup(await Index());
  for (const label of ['href="/hackathons/build"', "Active", "Ended", "1 project", "3 projects", "Singapore"])
    expect(html).toContain(label);
});

it("offers guests sign-in and shows the empty gallery and public voting allowance", async () => {
  const html = await gallery();
  expect(html).toContain("Participant sign in with Google");
  expect(html).toContain("2 votes per person");
  expect(html).toContain("No published projects yet");
  expect(f.votes).not.toHaveBeenCalled();
  expect(f.count).not.toHaveBeenCalled();
  f.event.mockResolvedValue({ ...event, votesPerUser: 1, location: null, tracks: [] });
  const single = await gallery();
  expect(single).toContain("1 vote per person");
  expect(single).toContain("Online");
});

it("keeps filters on pagination and allows withdrawal of a vote for an unavailable project", async () => {
  f.viewer.mockResolvedValue(viewer);
  f.member.mockResolvedValue({ id: "member" });
  f.votes.mockResolvedValue([{ projectId: "withdrawn", project: { status: "HIDDEN" } }]);
  f.projects.mockResolvedValue([{
    ...project, contributorIds: [], team: { ...project.team, _count: { members: 1 } },
  }]);
  f.count.mockResolvedValue(56);
  const html = await gallery({ q: "team one", track: "web", page: "2" });
  expect(html).toContain('href="/hackathons/build/portal"');
  expect(html).toContain("1 of 2 votes remaining");
  expect(html).toContain("Withdraw vote for unavailable project 1");
  expect(html).toContain("Project Alpha");
  expect(html).toContain('data-own="true"');
  expect(f.projects).toHaveBeenCalledTimes(1);
  for (const page of [1, 3]) expect(html).toContain("q=team+one&amp;track=web&amp;page=" + page);
  expect(f.projects).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ status: "SUBMITTED", tracks: { some: { trackId: "web" } } }),
      skip: 24,
      take: 24,
    }),
  );
});

it("retains historical contributor ownership while serving other cards as eligible", async () => {
  f.viewer.mockResolvedValue(viewer);
  const team = { name: "Former team", _count: { members: 0 } };
  f.projects.mockResolvedValue([
    { ...project, team, contributorIds: [viewer.id] },
    { ...project, id: "other", team, name: "Someone else's project", contributorIds: [] },
  ]);
  const html = await gallery();
  expect(html).toContain('data-own="true">Project Alpha');
  expect(html).toContain('data-own="false">Someone');
  expect(f.count).not.toHaveBeenCalled();
});

it("clamps invalid pagination, limits query length and explains future voting and empty search results", async () => {
  f.event.mockResolvedValue({ ...event, votingOpensAt: new Date("2099-01-01") });
  f.viewer.mockResolvedValue(viewer);
  const html = await gallery({ page: "-20", q: "w".repeat(220) });
  expect(f.projects).toHaveBeenCalledWith(
    expect.objectContaining({
      skip: 0,
      where: expect.objectContaining({
        OR: expect.arrayContaining([{ name: { contains: "w".repeat(200), mode: "insensitive" } }]),
      }),
    }),
  );
  for (const label of [
    "Opens ",
    "Voting is closed",
    "No projects match your search",
    "View all projects",
    "email on your invitation",
  ])
    expect(html).toContain(label);
});

it("shows administrators a portal link even without a participant record on an ended event", async () => {
  f.event.mockResolvedValue({ ...event, status: "ENDED", tagline: null });
  f.viewer.mockResolvedValue({ ...viewer, isAdmin: true });
  expect(await gallery({ page: "invalid" })).toContain("Open participant portal");
});

it("exposes links, tracks and the signed-in viewer's own vote state on a submitted project", async () => {
  f.viewer.mockResolvedValue(viewer);
  f.votes.mockResolvedValue([{ projectId: "p" }]);
  f.count.mockResolvedValue(1);
  const html = await detail();
  for (const label of [
    "Orbit",
    "Web",
    "Open demo",
    "Watch video",
    "View repository",
    "&quot;voted&quot;:true",
    "&quot;own&quot;:true",
  ])
    expect(html).toContain(label);
  expect(f.project).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "p", hackathon: { slug: "build", status: { not: "DRAFT" } }, status: "SUBMITTED" } }),
  );
});

it("shows a guest project without optional tracks or a demo", async () => {
  f.project.mockResolvedValue({ ...project, hackathon: event, demoUrl: null, tracks: [] });
  const html = await detail();
  expect(html).toContain("Project Alpha");
  expect(html).not.toContain("Open demo");
  expect(f.votes).not.toHaveBeenCalled();
});

it("returns not found for unknown events and unpublished projects", async () => {
  f.event.mockResolvedValue(null);
  await expect(gallery()).rejects.toThrow();
  f.project.mockResolvedValue(null);
  await expect(detail()).rejects.toThrow();
  expect(f.votes).not.toHaveBeenCalled();
});
