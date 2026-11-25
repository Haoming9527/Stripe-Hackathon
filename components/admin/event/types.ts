import type { Prisma } from "@prisma/client";

export const adminHeaderFields = {
  id: true, title: true, slug: true, status: true, location: true, timezone: true, startsAt: true,
} as const;

export const overviewFields = {
  ...adminHeaderFields,
  description: true, maxTeamSize: true, minTeamSize: true, maxTrackSelections: true, votesPerUser: true,
  submissionsClosed: true, submissionOpensAt: true, submissionClosesAt: true,
  votingClosed: true, votingOpensAt: true, votingClosesAt: true,
  _count: { select: { participants: true, teams: true, projects: true, votes: true, tracks: true } },
} satisfies Prisma.HackathonSelect;

export type OverviewEvent = Prisma.HackathonGetPayload<{ select: typeof overviewFields }>;

export type EventDetails = Prisma.HackathonGetPayload<{
  include: {
    tracks: true;
    _count: {
      select: { participants: true; teams: true; projects: true; votes: true; tracks: true };
    };
  };
}>;
