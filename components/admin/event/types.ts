import type { Prisma } from "@prisma/client";

export type EventDetails = Prisma.HackathonGetPayload<{
  include: {
    tracks: true;
    _count: {
      select: { participants: true; teams: true; projects: true; votes: true };
    };
  };
}>;
