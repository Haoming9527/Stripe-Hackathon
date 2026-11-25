import "server-only";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/auth";
import { findParticipant } from "@/lib/queries";

type Registration = NonNullable<Awaited<ReturnType<typeof findParticipant>>>;

function currentTeamWhere(teamId: string, member: Registration) {
  return {
    id: teamId,
    hackathonId: member.hackathonId,
    members: { some: { id: member.id, revokedAt: null } },
  };
}

function pendingInvitations(member: Registration) {
  return {
    participantId: member.id,
    status: "PENDING" as const,
    team: { hackathonId: member.hackathonId },
  };
}

async function loadRoster(member: Registration, viewerId: string) {
  const team = member.teamId
    ? await prisma.team.findUnique({
        where: currentTeamWhere(member.teamId, member),
        select: {
          id: true, name: true, ownerId: true, rosterLockedAt: true,
          members: {
            where: { OR: [{ revokedAt: null }, { team: { ownerId: viewerId } }] },
            select: {
              id: true, userId: true, name: true, normalizedEmail: true, revokedAt: true,
              user: { select: { name: true } },
            },
          },
          _count: { select: { members: true } },
          invitations: {
            where: { status: "PENDING" },
            select: { id: true, participant: { select: { normalizedEmail: true } } },
          },
        },
      })
    : null;
  // A team may have been dissolved since the registration was read.
  const invitations = team ? [] : await prisma.teamInvitation.findMany({
    where: pendingInvitations(member),
    select: {
      id: true,
      team: { select: { name: true, _count: { select: { members: true } }, owner: { select: { name: true } } } },
    },
  });
  return { team, invitations };
}

/** Keep authorization and private portal queries together. Never import on the client. */
export async function loadPortal(slug: string, requestedTab?: string) {
  const tab = ["overview", "team", "submission", "credits"].includes(
    requestedTab || "",
  )
    ? requestedTab!
    : "overview";
  const viewer = await getViewer();
  if (!viewer)
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/hackathons/${slug}/portal`)}`,
    );
  // Credits falls back to overview when the organizer hasn't added any offers.
  const showOverview = tab === "overview" || tab === "credits";
  const event = await prisma.hackathon.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, status: true, timezone: true,
      submissionsClosed: true, submissionOpensAt: true, submissionClosesAt: true,
      startsAt: showOverview, description: showOverview, location: showOverview,
      meetingUrl: showOverview, attendeeInfo: showOverview, schedule: showOverview,
      resources: showOverview, prizes: showOverview,
      minTeamSize: tab === "team", maxTeamSize: tab === "team",
      maxTrackSelections: tab === "submission",
      tracks: tab === "submission" && {
        orderBy: { position: "asc" }, select: { id: true, name: true, description: true },
      },
    },
  });
  if (!event || (event.status === "DRAFT" && !viewer.isAdmin)) notFound();
  const participant = await findParticipant(event.id, viewer.id, viewer.email);
  if (!participant && !viewer.isAdmin)
    return { access: false as const, viewer, event };
  const [roster, submissionTeam, pendingInvite, offers, firstOffer] = await Promise.all([
    tab === "team" && participant ? loadRoster(participant, viewer.id) : null,
    tab === "submission" && participant?.teamId
      ? prisma.team.findUnique({
          where: currentTeamWhere(participant.teamId, participant),
          select: { id: true, name: true, project: { include: { tracks: { select: { trackId: true } } } } },
        })
      : null,
    tab !== "team" && participant && !participant.teamId
      ? prisma.teamInvitation.findFirst({ where: pendingInvitations(participant), select: { id: true } })
      : null,
    tab === "credits"
      ? prisma.creditOffer.findMany({
          where: { hackathonId: event.id },
          include: {
            vouchers: {
              where: { participantId: participant?.id ?? "__none__" },
              select: { id: true, encryptedValue: true, claimedAt: true },
            },
          },
          orderBy: { createdAt: "asc" },
        })
      : [],
    tab !== "credits"
      ? prisma.creditOffer.findFirst({ where: { hackathonId: event.id }, select: { id: true } })
      : null,
  ]);
  const team = roster?.team ?? null;
  const invitations = roster?.invitations ?? [];
  const hasCreditOffers = !!firstOffer || offers.length > 0;
  const now = new Date();
  const submissionsOpen =
    event.status === "ACTIVE" &&
    !event.submissionsClosed &&
    now >= event.submissionOpensAt &&
    now < event.submissionClosesAt;
  const teamsOpen =
    event.status === "ACTIVE" &&
    !event.submissionsClosed &&
    now < event.submissionClosesAt;
  const canManageTeam =
    !!team && team.ownerId === viewer.id && !team.rosterLockedAt && teamsOpen;

  return {
    access: true as const,
    viewer,
    event,
    participant,
    team,
    submissionTeam,
    invitations,
    hasInvitations: !!pendingInvite || invitations.length > 0,
    now,
    submissionsOpen,
    teamsOpen,
    canManageTeam,
    offers,
    hasCreditOffers,
    tab: tab === "credits" && !hasCreditOffers ? "overview" : tab,
  };
}

export type PortalData = Extract<
  Awaited<ReturnType<typeof loadPortal>>,
  { access: true }
>;
