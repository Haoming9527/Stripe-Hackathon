import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

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

export const publicEventSelect = {
  id: true,
  slug: true,
  title: true,
  tagline: true,
  startsAt: true,
  endsAt: true,
  status: true,
  location: true,
  timezone: true,
  votesPerUser: true,
  votingOpensAt: true,
  votingClosesAt: true,
  votingClosed: true,
  tracks: {
    select: { id: true, name: true },
    orderBy: { position: "asc" as const },
  },
  _count: { select: { projects: { where: { status: "SUBMITTED" as const } } } },
} satisfies Prisma.HackathonSelect;

export async function listPublicEvents() {
  return prisma.hackathon.findMany({
    where: { status: { not: "DRAFT" } },
    select: publicEventSelect,
    orderBy: [{ startsAt: "desc" }],
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
) {
  return prisma.participant.findFirst({
    where: {
      hackathonId,
      revokedAt: null,
      normalizedEmail: email.trim().toLowerCase(),
      OR: [{ userId }, { userId: null }],
    },
  });
}
