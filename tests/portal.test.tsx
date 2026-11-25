import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPortal, type PortalData } from "@/components/portal/data";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { OverviewTab } from "@/components/portal/OverviewTab";
import { TeamTab } from "@/components/portal/TeamTab";
import { SubmissionTab } from "@/components/portal/SubmissionTab";
import { CreditsTab } from "@/components/portal/CreditsTab";
import { adminEvent } from "./admin-fixture";

const db = vi.hoisted(() => ({
  viewer: vi.fn(),
  event: vi.fn(),
  participant: vi.fn(),
  team: vi.fn(),
  invitations: vi.fn(),
  offers: vi.fn(),
  firstOffer: vi.fn(),
  decrypt: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    hackathon: { findUnique: db.event },
    team: { findUnique: db.team },
    teamInvitation: { findMany: db.invitations },
    creditOffer: { findMany: db.offers, findFirst: db.firstOffer },
  },
}));
vi.mock("@/lib/auth", () => ({ getViewer: db.viewer }));
vi.mock("@/lib/queries", () => ({ findParticipant: db.participant }));
vi.mock("@/lib/actions", () => ({ submitAction: vi.fn() }));
vi.mock("@/lib/credits", () => ({ decryptVoucher: db.decrypt }));

const now = adminEvent.startsAt;
const viewer = { id: "owner", email: "owner@example.com", image: null, name: "Sam", isAdmin: false };
const participant = {
  id: "p1",
  hackathonId: adminEvent.id,
  normalizedEmail: viewer.email,
  name: viewer.name,
  userId: viewer.id,
  teamId: "team",
  revokedAt: null,
  createdAt: now,
};
const invite = {
  id: "inv",
  participantId: "p2",
  teamId: "team",
  status: "PENDING" as const,
  createdAt: now,
  updatedAt: now,
};
const team: NonNullable<PortalData["team"]> = {
  id: "team",
  hackathonId: adminEvent.id,
  name: "Green team",
  ownerId: viewer.id,
  _count: { members: 2 },
  rosterLockedAt: null,
  createdAt: now,
  project: null,
  invitations: [{ ...invite, participant: { normalizedEmail: "invitee@example.com" } }],
  members: [
    { ...participant, user: { name: viewer.name } },
    {
      ...participant,
      id: "p2",
      userId: null,
      name: null,
      user: null,
      normalizedEmail: "other@example.com",
      revokedAt: now,
    },
  ],
};
const incoming = {
  ...invite,
  team: { name: team.name, owner: { name: viewer.name }, _count: { members: 2 } },
};
const base = {
  event: adminEvent,
  team,
  now,
  viewer,
  participant,
  canManageTeam: true,
  teamsOpen: true,
  submissionsOpen: true,
  invitations: [],
};
const html = renderToStaticMarkup;

beforeEach(() => {
  vi.resetAllMocks();
  db.viewer.mockResolvedValue(viewer);
  db.event.mockResolvedValue(adminEvent);
  db.participant.mockResolvedValue(participant);
  db.team.mockResolvedValue(team);
  db.invitations.mockResolvedValue([incoming]);
  db.offers.mockResolvedValue([]);
});

describe("participant portal access and data", () => {
  it("sends a signed-out visitor back through login and hides drafts from participants", async () => {
    db.viewer.mockResolvedValueOnce(null);
    await expect(loadPortal(adminEvent.slug)).rejects.toMatchObject({
      digest: expect.stringContaining(encodeURIComponent("/hackathons/community-build/portal")),
    });
    expect(db.event).not.toHaveBeenCalled();
    db.event.mockResolvedValueOnce({ ...adminEvent, status: "DRAFT" });
    await expect(loadPortal(adminEvent.slug)).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
    expect(db.participant).not.toHaveBeenCalled();
  });

  it("withholds private team and credit data from an unregistered viewer", async () => {
    db.participant.mockResolvedValue(null);
    expect(await loadPortal(adminEvent.slug, "credits")).toMatchObject({ access: false });
    expect(db.team).not.toHaveBeenCalled();
    expect(db.offers).not.toHaveBeenCalled();
  });

  it("loads an owner's team and limits credit queries to their registration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      db.offers.mockResolvedValue([{ id: "offer" }]);
      expect(await loadPortal(adminEvent.slug, "credits")).toMatchObject({
        team,
        tab: "credits",
        canManageTeam: true,
        submissionsOpen: true,
        hasCreditOffers: true,
      });
      expect(db.offers).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hackathonId: adminEvent.id },
          include: { vouchers: expect.objectContaining({ where: { participantId: participant.id } }) },
        }),
      );
      expect(db.invitations).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("loads invitations for teamless participants and falls back from unavailable tabs", async () => {
    db.participant.mockResolvedValue({ ...participant, teamId: null });
    expect(await loadPortal(adminEvent.slug, "credits")).toMatchObject({
      tab: "overview",
      invitations: [incoming],
    });
    db.firstOffer.mockResolvedValue({ id: "o1" });
    expect(await loadPortal(adminEvent.slug, "unknown")).toMatchObject({
      tab: "overview",
      hasCreditOffers: true,
      canManageTeam: false,
    });
    expect(db.team).not.toHaveBeenCalled();
  });

  it("allows administrators to preview a draft without membership", async () => {
    db.viewer.mockResolvedValue({ ...viewer, isAdmin: true });
    db.event.mockResolvedValue({ ...adminEvent, status: "DRAFT" });
    db.participant.mockResolvedValue(null);
    expect(await loadPortal(adminEvent.slug)).toMatchObject({
      access: true,
      teamsOpen: false,
      participant: null,
      invitations: [],
    });
  });
});

describe("participant portal views", () => {
  it("links an administrator back to the event editor and participants to the gallery", () => {
    const header = { event: adminEvent, viewer, tab: "team", hasCreditOffers: true, hasInvitations: true };
    const preview = html(<PortalHeader {...header} adminPreview />);
    expect(preview).toContain('href="/admin/event-1"');
    expect(preview).toContain("Pending invitations");
    expect(preview).toContain("?tab=credits");
    const normal = html(<PortalHeader {...header} adminPreview={false} hasCreditOffers={false} />);
    expect(normal).toContain('href="/hackathons/community-build"');
    expect(normal).not.toContain("?tab=credits");
  });

  it("shows organizer content as Markdown, lists resources and directs teams to their project", () => {
    const event = {
      ...adminEvent,
      attendeeInfo: "Bring a laptop",
      meetingUrl: "https://example.com/meet",
      resources: [{ title: "Docs", url: "https://example.com/docs", description: "API reference" }],
      prizes: [{ title: "First", amount: "One trophy" }],
    };
    const view = html(<OverviewTab {...base} event={event} />);
    for (const content of [
      "<strong>Welcome</strong>",
      "Bring a laptop",
      "https://example.com/meet",
      "API reference",
      "One trophy",
      "Open your project",
      "Submissions open",
    ])
      expect(view).toContain(content);
    const early = html(
      <OverviewTab
        {...base}
        event={{ ...event, schedule: [], resources: [], prizes: [] }}
        team={null}
        now={event.createdAt}
        submissionsOpen={false}
      />,
    );
    for (const content of [
      "Upcoming submissions",
      "Open team page",
      "share the schedule",
      "Resources will appear",
      "Prize details",
    ])
      expect(early).toContain(content);
  });

  it("shows owners pending invitations, revoked members and roster actions until the team locks", () => {
    const owner = html(<TeamTab {...base} />);
    for (const content of [
      "invitee@example.com",
      "Access revoked",
      "Leave and dissolve team",
      'value="team.remove"',
      'value="invitation.cancel"',
    ])
      expect(owner).toContain(content);
    const locked = html(<TeamTab {...base} team={{ ...team, rosterLockedAt: now }} canManageTeam={false} />);
    expect(locked).toContain("roster is locked");
    expect(locked).not.toContain("Send invitation");
  });

  it("lets teamless participants respond to an invitation and explains empty or closed states", () => {
    const pending = html(<TeamTab {...base} team={null} invitations={[incoming]} />);
    for (const content of ["Create team", "Green team", "Accept invitation", "Decline"])
      expect(pending).toContain(content);
    const closed = html(<TeamTab {...base} team={null} teamsOpen={false} />);
    expect(closed).toContain("No invitations yet");
    expect(closed).toContain("Team creation is closed");
  });

  it("gates project submission by team, deadline and publication status", () => {
    expect(html(<SubmissionTab {...base} team={null} />)).toContain("Join or create a team");
    const draft = html(<SubmissionTab {...base} />);
    expect(draft).toContain("Save draft");
    expect(draft).toContain("Climate");
    const project = {
      id: "proj",
      name: "Low-carbon app",
      teamId: team.id,
      hackathonId: adminEvent.id,
      description: "A demo",
      demoUrl: null,
      videoUrl: "",
      githubUrl: "",
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      consentAt: now,
      consentUserId: viewer.id,
      contributorIds: [viewer.id],
      status: "SUBMITTED" as const,
      tracks: [{ projectId: "proj", trackId: "track-1" }],
    };
    const published = html(<SubmissionTab {...base} team={{ ...team, project }} submissionsOpen={false} />);
    for (const content of [
      "Published in gallery",
      "Update project",
      "now read-only",
      "/projects/proj",
      now.toISOString(),
    ])
      expect(published).toContain(content);
  });

  it("exposes only claimed voucher values and explains expired, corrupt and missing vouchers", () => {
    const offer = {
      id: "offer",
      hackathonId: adminEvent.id,
      name: "Cloud",
      sponsor: "Sponsor",
      description: "Cloud credit",
      instructions: "Use at checkout",
      valueLabel: "$10",
      expiresAt: adminEvent.endsAt,
      redemptionUrl: "https://example.com/redeem",
      createdAt: now,
      vouchers: [],
    };
    const voucher = { id: "v1", encryptedValue: "private", claimedAt: null };
    expect(html(<CreditsTab {...base} offers={[]} />)).toContain("No sponsor offers yet");
    expect(html(<CreditsTab {...base} offers={[offer]} />)).toContain("Not assigned yet");
    const pending = html(<CreditsTab {...base} offers={[{ ...offer, vouchers: [voucher] }]} />);
    expect(pending).toContain("Claim your credit");
    expect(pending).not.toContain("private");
    expect(db.decrypt).not.toHaveBeenCalled();
    expect(html(<CreditsTab {...base} now={adminEvent.endsAt} offers={[offer]} />)).toContain(
      "claim period for this offer has ended",
    );
    const claimed = [{ ...offer, vouchers: [{ ...voucher, claimedAt: now }] }];
    db.decrypt.mockReturnValueOnce("REDEEM-10").mockImplementationOnce(() => {
      throw Error("invalid voucher");
    });
    expect(html(<CreditsTab {...base} offers={claimed} />)).toContain("<code>REDEEM-10</code>");
    expect(html(<CreditsTab {...base} offers={claimed} />)).toContain("contact the organizer");
  });
});
