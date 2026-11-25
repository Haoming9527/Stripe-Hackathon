import "server-only";
import type { Hackathon, Prisma } from "@prisma/client";
import { mergeAdminEdit } from "./merge-admin-edit";
import { eventEditValues, type EditValues } from "../admin-edit";
import type { Viewer } from "../types";
import {
  assert,
  DomainError,
  field,
  flag,
  integer,
  parseLocalDateTime,
  required,
  safeUrl,
  validTimezone,
} from "../validation";
import { admin, eventById, serializable, type MutationResult } from "./shared";

function records(form: FormData, key: string): Record<string, unknown>[] {
  const raw = field(form, key, 100_000);
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : [];
  } catch {
    throw new DomainError(`${key} must contain a valid list.`);
  }
  assert(
    Array.isArray(parsed) && parsed.length <= 100,
    `${key} must contain at most 100 items.`,
  );
  assert(
    parsed.every(
      (item) => item && typeof item === "object" && !Array.isArray(item),
    ),
    `${key} contains an invalid item.`,
  );
  return parsed as Record<string, unknown>[];
}

function recordText(
  record: Record<string, unknown>,
  key: string,
  max: number,
): string {
  const value = record[key] ?? "";
  assert(
    typeof value === "string" && value.length <= max,
    `${key} must be text of at most ${max} characters.`,
  );
  return value.trim();
}

export async function saveEvent(
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  admin(viewer);
  const id = field(form, "id", 100);
  const event = await serializable(async (tx) => {
    const existing = id ? await eventById(tx, id) : null;
    if (existing) {
      const tracks = await tx.track.findMany({ where: { hackathonId: id }, orderBy: { position: "asc" } });
      const current = eventEditValues(existing, tracks);
      const merged = mergeAdminEdit(form, current, ["tracks", "resources", "schedule", "prizes"]);
      return persistEvent(tx, merged, existing, current);
    }
    return persistEvent(tx, form, null);
  });
  return {
    message: "Hackathon saved.",
    redirectTo: id ? undefined : `/admin/${event.id}`,
  };
}

async function persistEvent(tx: Prisma.TransactionClient, form: FormData, existing: Hackathon | null, current?: EditValues) {
  const id = existing?.id ?? "";
  const title = required(form, "title", "an event title", 150);
  const slug = required(form, "slug", "an event URL", 80).toLowerCase();
  assert(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
    "Use lowercase letters, numbers, and single hyphens in the event URL.",
  );
  const timezone = validTimezone(
    field(form, "timezone", 100) || "Asia/Singapore",
  );
  const startsAt = parseLocalDateTime(
    field(form, "startsAt", 50),
    timezone,
    "the event start",
  );
  const endsAt = parseLocalDateTime(
    field(form, "endsAt", 50),
    timezone,
    "the event end",
  );
  const submissionOpensAt = parseLocalDateTime(
    field(form, "submissionOpensAt", 50),
    timezone,
    "the submission opening time",
  );
  const submissionClosesAt = parseLocalDateTime(
    field(form, "submissionClosesAt", 50),
    timezone,
    "the submission deadline",
  );
  const votingOpensAt = parseLocalDateTime(
    field(form, "votingOpensAt", 50),
    timezone,
    "the voting opening time",
  );
  const votingClosesAt = parseLocalDateTime(
    field(form, "votingClosesAt", 50),
    timezone,
    "the voting deadline",
  );
  assert(endsAt > startsAt, "The event must end after it starts.");
  assert(
    submissionClosesAt > submissionOpensAt,
    "Submissions must close after they open.",
  );
  assert(votingClosesAt > votingOpensAt, "Voting must close after it opens.");
  const maxTeamSize = integer(form, "maxTeamSize", 4, 1, 100);
  const teamSizeCeiling = integer(form, "teamSizeCeiling", maxTeamSize, maxTeamSize, 100);
  const minTeamSize = integer(form, "minTeamSize", 1, 1, maxTeamSize);
  const votesPerUser = integer(form, "votesPerUser", 3, 0, 100);
  const maxTrackSelections = integer(form, "maxTrackSelections", 1, 1, 100);
  const tracks = records(form, "tracks").map((track, position) => ({
    id: recordText(track, "id", 100),
    name: recordText(track, "name", 100),
    description: recordText(track, "description", 1000),
    position,
  }));
  assert(
    tracks.every((track) => track.name),
    "Give every track a name.",
  );
  assert(
    new Set(tracks.map((track) => track.name.toLowerCase())).size ===
      tracks.length,
    "Track names must be unique.",
  );
  const schedule = records(form, "schedule").map((item) => ({
    time: recordText(item, "time", 100),
    label: recordText(item, "label", 300),
  }));
  const resources = records(form, "resources").map((item) => ({
    title: recordText(item, "title", 150),
    url: safeUrl(recordText(item, "url", 2048), "resource URL")!,
  }));
  const prizes = records(form, "prizes").map((item) => ({
    title: recordText(item, "title", 150),
    description: recordText(item, "description", 2000),
  }));
  const requestedStatus = field(form, "status", 20);
  assert(
    !requestedStatus || ["DRAFT", "ACTIVE", "ENDED"].includes(requestedStatus),
    "Choose a valid event status.",
  );
  const status = (requestedStatus || existing?.status || "DRAFT") as
    "DRAFT" | "ACTIVE" | "ENDED";
  assert(
    !existing || existing.status === "DRAFT" || existing.slug === slug,
    "A published event's URL cannot be changed.",
  );
  assert(
    !existing || existing.status === "DRAFT" || status !== "DRAFT",
    "Published events cannot become drafts again. End the event instead.",
  );
  if (existing) {
    const teams = await tx.team.findMany({
      where: { hackathonId: id },
      include: { _count: { select: { members: true } } },
    });
    assert(
      teams.every((team) => team._count.members <= maxTeamSize),
      "The team limit is smaller than an existing team. Keep the current limit or increase it.",
    );
    assert(teams.every(team => !team.rosterLockedAt || team._count.members >= minTeamSize),
      "The minimum exceeds the size of a team whose roster is already locked.");
    const ballots = await tx.vote.groupBy({
      by: ["userId"],
      where: { hackathonId: id },
      _count: { id: true },
    });
    assert(
      ballots.every((ballot) => ballot._count.id <= votesPerUser),
      "The vote allowance is smaller than votes already cast. Keep the current allowance or increase it.",
    );
    const projects = await tx.project.findMany({
      where: { hackathonId: id },
      include: { _count: { select: { tracks: true } } },
    });
    assert(
      projects.every(
        (project) => project._count.tracks <= maxTrackSelections,
      ),
      "The track limit is smaller than an existing project's selections.",
    );
  }
  const taken = await tx.hackathon.findUnique({ where: { slug } });
  assert(!taken || taken.id === id, "That event URL is already in use.");
  const data = {
    title,
    slug,
    timezone,
    startsAt,
    endsAt,
    submissionOpensAt,
    submissionClosesAt,
    votingOpensAt,
    votingClosesAt,
    maxTeamSize,
    minTeamSize,
    teamSizeCeiling,
    votesPerUser,
    maxTrackSelections,
    status,
    tagline: field(form, "tagline", 250),
    description: field(form, "description", 20_000),
    location: field(form, "location", 250),
    meetingUrl: safeUrl(field(form, "meetingUrl", 2048), "meeting URL", true),
    attendeeInfo: field(form, "attendeeInfo", 20_000),
    schedule,
    resources,
    prizes,
    ...(status === "ENDED"
      ? { submissionsClosed: true, votingClosed: true }
      : {}),
  };
  // Only persist edited fields. In particular, untouched timestamps retain seconds
  // and untouched JSON lists retain any fields from earlier event formats.
  const changes = Object.fromEntries(Object.entries(data).filter(([key]) =>
    !current || (key in current ? form.get(key) !== current[key] ||
      (key.endsWith("At") && timezone !== current.timezone) : status !== current.status)
  ));
  const tracksChanged = !current || form.get("tracks") !== current.tracks;
  const saved = existing
    ? await tx.hackathon.update({ where: { id }, data: { ...changes, ...(tracksChanged ? { updatedAt: new Date() } : {}) } })
    : await tx.hackathon.create({ data });
  if (!tracksChanged) return saved;
  const oldTracks = await tx.track.findMany({
    where: { hackathonId: saved.id },
    include: { _count: { select: { projects: true } } },
  });
  const oldIds = new Set(oldTracks.map((track) => track.id));
  for (const track of tracks)
    assert(
      !track.id || oldIds.has(track.id),
      "One of the tracks belongs to another event.",
    );
  const keptIds = new Set(tracks.map((track) => track.id).filter(Boolean));
  const removed = oldTracks.filter((track) => !keptIds.has(track.id));
  assert(
    removed.every((track) => track._count.projects === 0),
    "A track used by a project cannot be removed.",
  );
  if (removed.length)
    await tx.track.deleteMany({
      where: { id: { in: removed.map((track) => track.id) } },
    });
  // Temporary names allow admins to swap two existing track names safely.
  for (const track of tracks.filter((track) => track.id))
    await tx.track.update({
      where: { id: track.id },
      data: { name: `__updating_${track.id}` },
    });
  for (const track of tracks) {
    const trackData = {
      name: track.name,
      description: track.description,
      position: track.position,
    };
    if (track.id)
      await tx.track.update({ where: { id: track.id }, data: trackData });
    else
      await tx.track.create({
        data: { ...trackData, hackathonId: saved.id },
      });
  }
  return saved;
}

export async function deleteEvent(
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  admin(viewer);
  const id = required(form, "hackathonId", "a hackathon");
  await serializable(async (tx) => {
    const event = await eventById(tx, id);
    assert(
      field(form, "confirmation", 200) === event.slug,
      "Type the hackathon URL slug exactly to confirm deletion.",
    );
    // Remove restrictive children before cascading the event's remaining data.
    await tx.creditVoucher.deleteMany({
      where: { offer: { hackathonId: id } },
    });
    await tx.projectTrack.deleteMany({
      where: { project: { hackathonId: id } },
    });
    await tx.hackathon.delete({ where: { id } });
  });
  return { message: "Hackathon deleted.", redirectTo: "/admin" };
}

export async function changeEvent(
  form: FormData,
  viewer: Viewer,
  windows: boolean,
): Promise<MutationResult> {
  admin(viewer);
  const id = required(form, "hackathonId", "a hackathon");
  await serializable(async (tx) => {
    const event = await eventById(tx, id);
    if (windows) {
      const values = mergeAdminEdit(form, {
        submissionsClosed: event.submissionsClosed ? "on" : "",
        votingClosed: event.votingClosed ? "on" : "",
      });
      assert(
        event.status !== "ENDED",
        "Reactivate the event before reopening submissions or voting.",
      );
      await tx.hackathon.update({
        where: { id },
        data: {
          submissionsClosed: flag(values, "submissionsClosed"),
          votingClosed: flag(values, "votingClosed"),
        },
      });
    } else {
      const status = field(mergeAdminEdit(form, { status: event.status }), "status", 20);
      assert(
        status === "DRAFT" || status === "ACTIVE" || status === "ENDED",
        "Choose a valid status.",
      );
      assert(
        event.status === "DRAFT" || status !== "DRAFT",
        "Published events cannot become drafts again.",
      );
      await tx.hackathon.update({
        where: { id },
        data: {
          status,
          ...(status === "ENDED"
            ? { submissionsClosed: true, votingClosed: true }
            : {}),
        },
      });
    }
  });
  return { message: "Event settings updated." };
}
