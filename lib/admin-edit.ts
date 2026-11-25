import type { CreditOffer, Hackathon, Track } from "@prisma/client";
import { localDateValue } from "@/components/admin/format";

export type EditValues = Record<string, string>;

export function eventEditValues(
  event: Hackathon,
  tracks: Pick<Track, "id" | "name" | "description">[],
): EditValues {
  const values: EditValues = {};
  for (const key of [
    "title",
    "slug",
    "status",
    "timezone",
    "tagline",
    "description",
    "location",
    "meetingUrl",
    "attendeeInfo",
    "maxTeamSize",
    "votesPerUser",
    "maxTrackSelections",
  ] as const)
    values[key] = String(event[key] ?? "");
  for (const key of [
    "startsAt",
    "endsAt",
    "submissionOpensAt",
    "submissionClosesAt",
    "votingOpensAt",
    "votingClosesAt",
  ] as const)
    values[key] = localDateValue(event[key], event.timezone);
  for (const key of ["schedule", "resources", "prizes"] as const)
    values[key] = JSON.stringify(event[key]);
  values.tracks = JSON.stringify(
    tracks.map(({ id, name, description }) => ({ id, name, description })),
  );
  return values;
}

export function offerEditValues(
  offer: CreditOffer,
  timezone: string,
): EditValues {
  const values: EditValues = {
    expiresAt: localDateValue(offer.expiresAt, timezone),
  };
  for (const key of [
    "name",
    "sponsor",
    "valueLabel",
    "description",
    "instructions",
    "redemptionUrl",
  ] as const)
    values[key] = offer[key] ?? "";
  return values;
}
