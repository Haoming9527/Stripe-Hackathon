import "server-only";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/auth";
import { findParticipant } from "@/lib/queries";

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
  const event = await prisma.hackathon.findUnique({
    where: { slug },
    include: { tracks: { orderBy: { position: "asc" } } },
  });
  if (!event || (event.status === "DRAFT" && !viewer.isAdmin)) notFound();
  const participant = await findParticipant(event.id, viewer.id, viewer.email);
  if (!participant && !viewer.isAdmin)
    return { access: false as const, viewer, event };
  const team = participant?.teamId
    ? await prisma.team.findUnique({
        where: { id: participant.teamId },
        include: {
          members: {
            where: { OR: [{ revokedAt: null }, { team: { ownerId: viewer.id } }] },
            include: { user: { select: { name: true } } },
          },
          _count: { select: { members: true } },
          invitations: {
            where: { status: "PENDING" },
            include: { participant: { select: { normalizedEmail: true } } },
          },
          project: { include: { tracks: true } },
        },
      })
    : null;
  const invitations =
    participant && !team
      ? await prisma.teamInvitation.findMany({
          where: {
            participantId: participant.id,
            status: "PENDING",
            team: { hackathonId: event.id },
          },
          include: {
            team: {
              select: {
                name: true,
                _count: { select: { members: true } },
                owner: { select: { name: true } },
              },
            },
          },
        })
      : [];
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
  const offers =
    tab === "credits"
      ? await prisma.creditOffer.findMany({
          where: { hackathonId: event.id },
          include: {
            vouchers: {
              where: { participantId: participant?.id ?? "__none__" },
              select: { id: true, encryptedValue: true, claimedAt: true },
            },
          },
          orderBy: { createdAt: "asc" },
        })
      : [];

  return {
    access: true as const,
    viewer,
    event,
    participant,
    team,
    invitations,
    now,
    submissionsOpen,
    teamsOpen,
    canManageTeam,
    offers,
    tab,
  };
}

export type PortalData = Extract<
  Awaited<ReturnType<typeof loadPortal>>,
  { access: true }
>;
