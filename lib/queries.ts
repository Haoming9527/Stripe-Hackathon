import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeIdentityEmail } from "@/lib/auth-policy";
import type { Viewer } from "@/lib/types";

/** A project's own team includes registered accounts and unclaimed roster emails. */
export function votingMemberFilter(viewer: Viewer): Prisma.ParticipantWhereInput {
  return {
    OR: [{ userId: viewer.id }, { userId: null, normalizedEmail: normalizeIdentityEmail(viewer.email) }],
  };
}

// Explicit public projections exclude participant emails, vouchers and totals.
export const publicProjectSelect = {
  id: true,
  name: true,
  description: true,
  demoUrl: true,
  videoUrl: true,
  githubUrl: true,
  publishedAt: true,
  teamId: true,
  team: { select: { name: true } },
  tracks: { select: { track: { select: { id: true, name: true } } } },
} satisfies Prisma.ProjectSelect;

export type PublicProject = Prisma.ProjectGetPayload<{
  select: typeof publicProjectSelect;
}>;

const directoryEventSelect = {
  id: true,
  slug: true,
  title: true,
  tagline: true,
  startsAt: true,
  status: true,
  location: true,
  timezone: true,
  _count: { select: { projects: { where: { status: "SUBMITTED" } } } },
} satisfies Prisma.HackathonSelect;

export const publicEventSelect = {
  ...directoryEventSelect,
  endsAt: true,
  votesPerUser: true,
  votingOpensAt: true,
  votingClosesAt: true,
  votingClosed: true,
  tracks: {
    select: { id: true, name: true },
    orderBy: { position: "asc" as const },
  },
} satisfies Prisma.HackathonSelect;

export async function listPublicEvents() {
  return prisma.hackathon.findMany({
    where: { status: { not: "DRAFT" } },
    select: directoryEventSelect,
    orderBy: [{ startsAt: "desc" }],
  });
}

export function findFeaturedEvent() {
  return prisma.hackathon.findFirst({
    where: { status: { in: ["ACTIVE", "ENDED"] } },
    // The database enum orders ACTIVE ahead of ENDED.
    orderBy: [{ status: "asc" }, { startsAt: "desc" }, { id: "asc" }],
    select: { id: true, slug: true, title: true, startsAt: true, timezone: true, location: true },
  });
}

export async function findPublicEvent(slug: string) {
  return prisma.hackathon.findFirst({
    where: { slug, status: { not: "DRAFT" } },
    select: publicEventSelect,
  });
}

export async function findParticipant(
  hackathonId: string,
  userId: string,
  email: string,
  client: Pick<Prisma.TransactionClient, "participant"> = prisma,
) {
  const linked = await client.participant.findUnique({
    where: { hackathonId_userId: { hackathonId, userId } },
  });
  // A linked registration, including its revocation, takes precedence over
  // an invitation imported for a later email address.
  if (linked) return linked.revokedAt ? null : linked;
  return client.participant.findUnique({
    where: {
      hackathonId_normalizedEmail: {
        hackathonId,
        normalizedEmail: normalizeIdentityEmail(email),
      },
      revokedAt: null,
      userId: null,
    },
  });
}
