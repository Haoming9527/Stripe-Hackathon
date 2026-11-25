// @vitest-environment jsdom
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { prerender } from "react-dom/static";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminError from "@/app/admin/error";
import AdminLayout from "@/app/admin/layout";
import AdminLoading from "@/app/admin/loading";
import AdminHome from "@/app/admin/page";
import AdminEventPage from "@/app/admin/[id]/page";
import NewHackathon from "@/app/admin/new/page";
import { adminEvent } from "./admin-fixture";

const { getViewer, db } = vi.hoisted(() => ({
  getViewer: vi.fn(),
  db: {
    hackathon: { findMany: vi.fn(), findUnique: vi.fn() },
    participant: { findMany: vi.fn() },
    team: { findMany: vi.fn() },
    project: { findMany: vi.fn() },
    creditOffer: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ getViewer }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/actions", () => ({ submitAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error("Redirect to " + url);
  },
  notFound: () => {
    throw new Error("Page not found");
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Wait for all nested async tab components, including the event page's Suspense
// boundary, before inspecting the HTML that would reach the organizer.
async function page(node: ReactNode) {
  const errors: unknown[] = [];
  const { prelude } = await prerender(node, {
    onError: (error) => {
      errors.push(error);
    },
  });
  if (errors.length) throw errors[0];
  const container = document.createElement("div");
  container.innerHTML = await new Response(prelude).text();
  return within(container);
}

async function eventTab(tab?: string) {
  return page(
    await AdminEventPage({
      params: Promise.resolve({ id: adminEvent.id }),
      searchParams: Promise.resolve({ tab }),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_SECRET", "admin-page-invitation-test-key");
  getViewer.mockResolvedValue({ id: "organizer", isAdmin: true });
  db.hackathon.findUnique.mockResolvedValue(adminEvent);
  db.hackathon.findMany.mockResolvedValue([]);
  db.participant.findMany.mockResolvedValue([]);
  db.team.findMany.mockResolvedValue([]);
  db.project.findMany.mockResolvedValue([]);
  db.creditOffer.findMany.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("admin workspace", () => {
  it("redirects anonymous visitors and protects the data query from non-admin access", async () => {
    getViewer.mockResolvedValue(null);
    await expect(AdminLayout({ children: "Private" })).rejects.toThrow(
      "Redirect to /login?callbackUrl=/admin",
    );
    await expect(AdminHome()).rejects.toThrow("Redirect to /login?callbackUrl=/admin");
    getViewer.mockResolvedValue({ isAdmin: false });
    const guest = await page(await AdminLayout({ children: "Private" }));
    expect(guest.getByRole("heading", { name: "Organizer access required" })).toBeDefined();
    expect(guest.queryByText("Private")).toBeNull();
    expect(guest.getByRole("link").getAttribute("href")).toBe("/hackathons");
    await expect(AdminHome()).rejects.toThrow("Page not found");
    expect(db.hackathon.findMany).not.toHaveBeenCalled();
  });

  it("provides organizer navigation, an empty dashboard and the new-event form", async () => {
    const workspace = await page(await AdminLayout({ children: "My workspace" }));
    expect(workspace.getByRole("navigation", { name: "Admin navigation" })).toBeDefined();
    expect(workspace.getByRole("link", { name: "Create hackathon" }).getAttribute("href")).toBe("/admin/new");
    expect(workspace.getByText("My workspace")).toBeDefined();
    const dashboard = await page(await AdminHome());
    expect(dashboard.getByRole("heading", { name: "No hackathons yet" })).toBeDefined();
    const create = await page(await NewHackathon());
    expect(create.getByRole("heading", { name: "Create a hackathon" })).toBeDefined();
    expect(create.getByLabelText(/Page URL/).hasAttribute("readonly")).toBe(false);
    expect(create.getByLabelText<HTMLSelectElement>("Visibility").value).toBe("DRAFT");
    expect(create.getByText("Enter a description to preview it here.")).toBeDefined();
    expect(create.getByRole("button", { name: "Create hackathon" })).toBeDefined();
  });

  it("aggregates participant and project counts across the dashboard", async () => {
    db.hackathon.findMany.mockResolvedValue([
      adminEvent,
      {
        ...adminEvent,
        id: "draft",
        status: "DRAFT",
        title: "Draft build",
        tagline: "",
        _count: { participants: 3, projects: 1 },
      },
    ]);
    const dashboard = await page(await AdminHome());
    expect(dashboard.getByRole("table", { name: "Your hackathons" })).toBeDefined();
    expect(dashboard.getByRole("link", { name: adminEvent.title }).getAttribute("href")).toBe(
      "/admin/event-1",
    );
    for (const [label, expected] of [
      ["Active now", "1"],
      ["Participants", "15"],
      ["Projects", "3"],
    ]) {
      const metric = dashboard.getByText(label, { selector: "span" });
      expect(metric.nextElementSibling?.textContent).toBe(expected);
    }
    expect(dashboard.getByText("Singapore")).toBeDefined();
  });

  it("reports loading and lets an organizer retry after a read error", () => {
    const reset = vi.fn();
    const view = render(<AdminLoading />);
    expect(view.getByRole("status", { name: "Loading" })).toBeDefined();
    view.rerender(<AdminError reset={reset} />);
    fireEvent.click(view.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});

describe("event management tabs", () => {
  it("defaults unknown tabs to overview and reflects both scheduled windows and saved overrides", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-02T09:00:00Z"));
    const overview = await eventTab("unknown");
    expect(overview.getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBe("page");
    expect(overview.getByRole("link", { name: /Participant view/ }).getAttribute("href")).toBe(
      "/hackathons/community-build/portal",
    );
    expect(overview.getByRole("link", { name: /View gallery/ }).getAttribute("href")).toBe(
      "/hackathons/community-build",
    );
    expect(overview.getByText("Welcome").tagName).toBe("STRONG");
    expect(overview.getByRole("row", { name: /Project submissions/ }).textContent).toContain("Open");
    expect(overview.getByRole("row", { name: /Community voting/ }).textContent).toContain("Closed");
    expect(overview.getByRole<HTMLInputElement>("checkbox", { name: /close voting/ }).checked).toBe(false);
    db.hackathon.findUnique.mockResolvedValue({
      ...adminEvent,
      status: "DRAFT",
      description: "",
      location: "",
      tracks: [],
      submissionsClosed: true,
      votingClosed: true,
    });
    const draft = await eventTab();
    expect(draft.queryByRole("link", { name: /View gallery/ })).toBeNull();
    expect(draft.getByText("No tracks")).toBeDefined();
    expect(draft.getByText("Not set")).toBeDefined();
    expect(
      draft.getByRole<HTMLInputElement>("checkbox", {
        name: /close submissions/,
      }).checked,
    ).toBe(true);
  });

  it("scopes settings to the selected event and requests its slug to confirm deletion", async () => {
    const settings = await eventTab("settings");
    expect(db.hackathon.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: adminEvent.id } }),
    );
    expect(settings.getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBe("page");
    expect(settings.getByDisplayValue(adminEvent.title)).toBeDefined();
    const confirmation = settings.getByLabelText<HTMLInputElement>("Type community-build to confirm");
    expect(confirmation.required).toBe(true);
    expect(confirmation.form?.elements.namedItem("hackathonId")).toHaveProperty("value", adminEvent.id);
    expect(confirmation.form?.elements.namedItem("intent")).toHaveProperty("value", "event.delete");
    db.hackathon.findUnique.mockResolvedValue(null);
    await expect(eventTab()).rejects.toThrow("Page not found");
  });

  it.each([
    ["participants", /Share the invitation link or add participants above/],
    ["teams", /Teams will appear here when participants create them/],
    ["projects", /Projects appear here as teams start drafting/],
    ["credits", /Create your first credit offer/],
  ] as const)("explains an empty %s tab", async (tab, message) => {
    const result = await eventTab(tab);
    expect(result.getByText(message)).toBeDefined();
  });

  it("distinguishes joined, invited and revoked participants and preserves locked identities", async () => {
    const base = {
      id: "a",
      name: null,
      normalizedEmail: "a@example.org",
      userId: null,
      teamId: null,
      team: null,
      user: null,
      revokedAt: null,
      createdAt: adminEvent.createdAt,
      _count: { vouchers: 0, invitations: 0 },
    };
    db.participant.findMany.mockResolvedValue([
      base,
      {
        ...base,
        id: "b",
        normalizedEmail: "b@example.org",
        userId: "user-b",
        user: { name: "Blair" },
        team: { name: "Team B" },
      },
      {
        ...base,
        id: "c",
        normalizedEmail: "c@example.org",
        name: "Casey",
        revokedAt: adminEvent.updatedAt,
      },
    ]);
    const list = await eventTab("participants");
    expect(list.getByRole("link", { name: "Open invitation link" }).getAttribute("href")).toMatch(
      /^\/join\/event-1\/[\w-]{43}$/,
    );
    expect(list.getByRole("link", { name: "Export CSV" }).getAttribute("href")).toContain(
      "hackathonId=event-1&type=participants",
    );
    const invited = within(list.getByRole("row", { name: /a@example.org/ }));
    expect(invited.getByText("Invited")).toBeDefined();
    expect(invited.getByDisplayValue<HTMLInputElement>("a@example.org").readOnly).toBe(false);
    const joined = within(list.getByRole("row", { name: /Blair/ }));
    expect(joined.getByText("Team B")).toBeDefined();
    expect(joined.getByText("Joined")).toBeDefined();
    expect(joined.getByDisplayValue<HTMLInputElement>("b@example.org").readOnly).toBe(true);
    const revoked = within(list.getByRole("row", { name: /Casey/ }));
    expect(revoked.getByText("Revoked")).toBeDefined();
    expect(
      revoked.getByText("Restore participant").closest("form")?.elements.namedItem("intent"),
    ).toHaveProperty("value", "participants.restore");
  });

  it("distinguishes open and locked team rosters and lists pending invitations", async () => {
    const team = {
      id: "a",
      name: "Sun",
      owner: { name: null, email: "a@example.org" },
      members: [{ normalizedEmail: "a@example.org" }],
      invitations: [{ id: "i" }],
      project: null,
      rosterLockedAt: null,
    };
    db.team.findMany.mockResolvedValue([
      team,
      {
        ...team,
        id: "b",
        name: "Moon",
        owner: { name: "Blair" },
        invitations: [],
        project: { name: "Lunar", status: "SUBMITTED" },
        rosterLockedAt: adminEvent.updatedAt,
      },
    ]);
    const teams = await eventTab("teams");
    const open = within(teams.getByRole("row", { name: /Sun/ }));
    expect(open.getByText("1 / 4")).toBeDefined();
    expect(open.getByText("1 pending invitations")).toBeDefined();
    expect(open.getByText("Open")).toBeDefined();
    expect(open.getByText("No project yet")).toBeDefined();
    const locked = within(teams.getByRole("row", { name: /Moon/ }));
    expect(locked.getByText("Lunar")).toBeDefined();
    expect(locked.getByText("Locked")).toBeDefined();
  });

  it("summarizes votes and offers moderation only for submitted and hidden projects", async () => {
    const project = {
      id: "a",
      name: "Prototype",
      status: "DRAFT",
      team: { name: "Builders" },
      tracks: [],
      _count: { votes: 0 },
      publishedAt: null,
    };
    db.project.findMany.mockResolvedValue([
      project,
      {
        ...project,
        id: "b",
        name: "Launch",
        status: "SUBMITTED",
        _count: { votes: 1 },
        tracks: [{ track: { name: "Climate" } }],
        publishedAt: adminEvent.startsAt,
        githubUrl: "https://github.com/example/launch",
        videoUrl: "https://example.org/demo",
      },
      { ...project, id: "c", name: "Archived demo", status: "HIDDEN" },
    ]);
    const projects = await eventTab("projects");
    expect(projects.getByText("1 published · 1 draft · 1 vote")).toBeDefined();
    expect(projects.getByRole("link", { name: "Launch" }).getAttribute("href")).toBe(
      "/hackathons/community-build/projects/b",
    );
    expect(projects.getByRole("link", { name: /Video/ }).getAttribute("href")).toBe(
      "https://example.org/demo",
    );
    expect(projects.getByText("Awaiting submission")).toBeDefined();
    for (const [button, target] of [
      ["Hide project", "HIDDEN"],
      ["Restore to gallery", "SUBMITTED"],
    ]) {
      expect(
        projects.getByRole<HTMLButtonElement>("button", { name: button }).form?.elements.namedItem("status"),
      ).toHaveProperty("value", target);
    }
  });

  it("reports available, assigned and claimed inventory and keeps revoked recipients in the history", async () => {
    const offer = {
      id: "api",
      name: "API grant",
      sponsor: "Sponsor",
      valueLabel: "$20",
      expiresAt: adminEvent.endsAt,
      description: "Build something",
      instructions: "Redeem the code",
      redemptionUrl: "https://example.org/redeem",
      vouchers: [
        { id: "free", participantId: null, assignedAt: null, claimedAt: null },
        {
          id: "claimed",
          participantId: "a",
          assignedAt: adminEvent.startsAt,
          claimedAt: adminEvent.startsAt,
        },
        {
          id: "revoked",
          participantId: "b",
          assignedAt: adminEvent.startsAt,
          claimedAt: null,
        },
      ],
    };
    db.creditOffer.findMany.mockResolvedValue([
      offer,
      {
        ...offer,
        id: "future",
        name: "Next offer",
        sponsor: "",
        valueLabel: "",
        expiresAt: null,
        redemptionUrl: null,
        vouchers: [],
      },
    ]);
    db.participant.findMany.mockResolvedValue([{ id: "a", name: null, normalizedEmail: "a@example.org" }]);
    const credits = await eventTab("credits");
    expect(db.participant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hackathonId: adminEvent.id, revokedAt: null },
      }),
    );
    const grant = within(credits.getByRole("heading", { name: "API grant" }).closest("section")!);
    expect(grant.getByText("assigned").textContent).toBe("2 assigned");
    expect(grant.getByText("claimed", { exact: true }).textContent).toBe("1 claimed");
    expect(grant.getByText("Allocation history (2)")).toBeDefined();
    expect(grant.getByText("Participant access revoked")).toBeDefined();
    expect(grant.getByText("a@example.org").closest("tr")?.textContent).toContain("Claimed");
    expect(grant.getByDisplayValue("https://example.org/redeem")).toBeDefined();
    expect(credits.getByText("No vouchers have been assigned yet.")).toBeDefined();
    expect(credits.getByRole("heading", { name: "Add another credit offer" })).toBeDefined();
  });
});
