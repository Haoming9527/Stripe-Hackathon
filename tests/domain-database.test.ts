/** Optional live PostgreSQL integration suite. It never uses the application schema. */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "../lib/types";
import { migrateTestSchema } from "../scripts/test-migrations.mjs";

const database = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock("server-only", () => ({}));
vi.mock("next-auth", () => ({ getServerSession: () => null }));
vi.mock("../lib/db", () => {
  const proxy = new Proxy({}, {
    get(_target, key) {
      const client = database.client;
      if (!client) throw new Error("The isolated test database has not been initialized.");
      const value = client[key as keyof PrismaClient];
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
  return { db: proxy, prisma: proxy };
});

import { performMutation } from "../lib/domain";
import { eventEditValues, offerEditValues } from "../lib/admin-edit";
import { joinInvitedHackathon } from "../lib/domain/participants";
import { decryptVoucher } from "../lib/credits";
import { authOptions } from "../lib/auth";
import { findFeaturedEvent, findParticipant, findPublicEvent, listPublicEvents } from "../lib/queries";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite("isolated PostgreSQL domain integration", () => {
  const schema = `hackathon_test_${randomUUID().replaceAll("-", "")}`;
  let control: PrismaClient;
  let db: PrismaClient;
  let eventId: string;
  let people: Viewer[];
  const encryptionBefore = process.env.CREDITS_ENCRYPTION_KEY;
  const runtimeDatabaseBefore = process.env.DATABASE_URL_POOLED;

  const data = (values: Record<string, string | string[]>): FormData => {
    const form = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      (Array.isArray(value) ? value : [value]).forEach(item => form.append(key, item));
    });
    return form;
  };

  beforeAll(async () => {
    const raw = process.env.TEST_DATABASE_URL!;
    const target = new URL(raw);
    if (!/^postgres(?:ql)?:$/.test(target.protocol)) throw new Error("TEST_DATABASE_URL must be PostgreSQL.");
    if (!/^hackathon_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Invalid isolated test schema.");
    control = new PrismaClient({ datasourceUrl: raw });
    await control.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    target.searchParams.set("schema", schema);
    process.env.DATABASE_URL_POOLED = target.toString();
    db = new PrismaClient({ datasourceUrl: target.toString() });
    database.client = db;
    await migrateTestSchema(target);
    process.env.CREDITS_ENCRYPTION_KEY = "47".repeat(32);
  }, 90_000);

  afterAll(async () => {
    if (db) await db.$disconnect();
    if (control) {
      if (!/^hackathon_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Refusing to drop an unrecognized schema.");
      await control.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await control.$disconnect();
    }
    if (encryptionBefore === undefined) delete process.env.CREDITS_ENCRYPTION_KEY;
    else process.env.CREDITS_ENCRYPTION_KEY = encryptionBefore;
    if (runtimeDatabaseBefore === undefined) delete process.env.DATABASE_URL_POOLED;
    else process.env.DATABASE_URL_POOLED = runtimeDatabaseBefore;
  }, 30_000);

  beforeEach(async () => {
    await db.creditVoucher.deleteMany();
    await db.projectTrack.deleteMany();
    await db.hackathon.deleteMany();
    await db.user.deleteMany();
    const now = Date.now();
    const event = await db.hackathon.create({ data: {
      slug: "test-build", title: "Integration hackathon", status: "ACTIVE", maxTeamSize: 2, votesPerUser: 1,
      startsAt: new Date(now - 3_600_000), endsAt: new Date(now + 3_600_000),
      submissionOpensAt: new Date(now - 3_600_000), submissionClosesAt: new Date(now + 3_600_000),
      votingOpensAt: new Date(now - 3_600_000), votingClosesAt: new Date(now + 3_600_000),
    } });
    eventId = event.id;
    people = [];
    for (let index = 0; index < 5; index++) {
      const user = await db.user.create({ data: { email: `person${index}@example.test`, name: `Person ${index}`, emailVerified: new Date() } });
      people.push({ id: user.id, email: user.email!, name: user.name, image: null, isAdmin: index === 0 });
      // The final person is a gallery-only voter.
      if (index < 4) await db.participant.create({ data: { hackathonId: eventId, normalizedEmail: user.email!, userId: user.id } });
    }
  }, 30_000);

  it("features the latest active event, falling back to the latest ended event and excluding drafts", async () => {
    const later = new Date("2100-01-01T00:00:00Z");
    const event = await db.hackathon.create({ data: {
      title: "Later event", slug: "later-event", status: "ENDED", startsAt: later, endsAt: later,
      submissionOpensAt: later, submissionClosesAt: later, votingOpensAt: later, votingClosesAt: later,
    } });
    expect(await findFeaturedEvent()).toMatchObject({ id: eventId });
    await db.hackathon.update({ where: { id: event.id }, data: { status: "ACTIVE" } });
    expect(await findFeaturedEvent()).toMatchObject({ id: event.id });
    await db.hackathon.updateMany({ data: { status: "ENDED" } });
    expect(await findFeaturedEvent()).toMatchObject({ id: event.id });
    await db.hackathon.updateMany({ data: { status: "DRAFT" } });
    expect(await findFeaturedEvent()).toBeNull();
  });

  it("enrolls invitees once, claims imported emails and respects revocation", async () => {
    const visitor = people[4];
    const retries = await Promise.all([
      joinInvitedHackathon(eventId, visitor),
      joinInvitedHackathon(eventId, visitor),
    ]);
    expect(retries).toEqual(["test-build", "test-build"]);
    expect(await db.participant.count({ where: { hackathonId: eventId, normalizedEmail: visitor.email, userId: visitor.id } })).toBe(1);
    const imported = await db.participant.findUniqueOrThrow({
      where: { hackathonId_userId: { hackathonId: eventId, userId: people[1].id } },
    });
    await db.participant.update({ where: { id: imported.id }, data: { userId: null } });
    expect(await joinInvitedHackathon(eventId, people[1])).toBe("test-build");
    expect(await db.participant.findUnique({ where: { id: imported.id } })).toMatchObject({ userId: people[1].id });
    await db.participant.update({ where: { id: imported.id }, data: { revokedAt: new Date() } });
    expect(await joinInvitedHackathon(eventId, people[1])).toBeNull();
  });

  it("merges concurrent organizer edits and rejects conflicting stale drafts atomically", async () => {
    const event = await db.hackathon.findUniqueOrThrow({ where: { id: eventId } });
    const original = eventEditValues(event, []);
    const draft = (fields: Record<string, string>) => data({
      ...original, id: eventId, original: JSON.stringify(original), ...fields,
    });
    const otherAdmin = { ...people[1], isAdmin: true };
    await Promise.all([
      performMutation("event.save", draft({ title: "New title", schedule: JSON.stringify([{ time: "9am", label: "Doors" }]) }), people[0]),
      performMutation("event.save", draft({ location: "New venue", schedule: JSON.stringify([{ time: "10am", label: "Start" }]) }), otherAdmin),
    ]);
    await expect(performMutation("event.save", draft({ title: "Conflict", tagline: "Must not save" }), otherAdmin)).rejects.toThrow("Another admin changed title");
    const saved = await db.hackathon.findUniqueOrThrow({ where: { id: eventId } });
    expect(saved).toMatchObject({ title: "New title", location: "New venue", tagline: "" });
    expect(saved.schedule).toEqual(expect.arrayContaining([{ time: "9am", label: "Doors" }, { time: "10am", label: "Start" }]));
  });

  async function teamFor(person: Viewer) {
    await performMutation("team.create", data({ hackathonId: eventId, name: `${person.name}'s team` }), person);
    return db.team.findFirstOrThrow({ where: { ownerId: person.id, hackathonId: eventId } });
  }

  async function projectFor(person: Viewer, name = "Working project") {
    const team = await teamFor(person);
    await performMutation("project.save", data({ hackathonId: eventId, teamId: team.id, name, description: "A working community project", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", githubUrl: "https://github.com/community/project", publish: "true", consent: "on" }), person);
    return db.project.findUniqueOrThrow({ where: { teamId: team.id } });
  }

  it("publishes a new event, swaps track names without changing IDs, and closes its windows", async () => {
    const source = await db.hackathon.findUniqueOrThrow({ where: { id: eventId } });
    const fields = {
      ...eventEditValues(source, []),
      title: "Build weekend", slug: "build-weekend", status: "DRAFT",
      tracks: JSON.stringify([{ name: "Payments" }, { name: "Climate" }, { name: "Unused" }]),
      resources: JSON.stringify([{ title: "Guide", url: "https://example.test/guide" }]),
      prizes: JSON.stringify([{ title: "First", description: "Gold medal" }]),
    };
    const created = await performMutation("event.save", data(fields), people[0]);
    const event = await db.hackathon.findUniqueOrThrow({ where: { slug: fields.slug } });
    expect(created.redirectTo).toBe(`/admin/${event.id}`);
    expect(event).toMatchObject({ status: "DRAFT", resources: JSON.parse(fields.resources), prizes: JSON.parse(fields.prizes) });
    expect(await findPublicEvent(event.slug)).toBeNull();
    expect((await listPublicEvents()).map(item => item.id)).not.toContain(event.id);
    const tracks = await db.track.findMany({ where: { hackathonId: event.id }, orderBy: { position: "asc" } });
    const original = eventEditValues(event, tracks);
    const updatedTracks = [
      { id: tracks[0].id, name: tracks[1].name }, { id: tracks[1].id, name: tracks[0].name }, { name: "Open" },
    ];
    await performMutation("event.save", data({
      ...original, id: event.id, original: JSON.stringify(original), status: "ACTIVE", tracks: JSON.stringify(updatedTracks),
    }), people[0]);
    const published = await findPublicEvent(event.slug);
    expect(published?.tracks).toEqual([
      { id: tracks[0].id, name: "Climate" }, { id: tracks[1].id, name: "Payments" }, { id: expect.any(String), name: "Open" },
    ]);
    expect(published).not.toHaveProperty("participants");
    expect(await db.track.findUnique({ where: { id: tracks[2].id } })).toBeNull();
    expect((await listPublicEvents()).map(item => item.id)).toContain(event.id);

    await performMutation("event.windows", data({
      hackathonId: event.id, original: JSON.stringify({ submissionsClosed: "", votingClosed: "" }), votingClosed: "on",
    }), people[0]);
    expect(await db.hackathon.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({
      submissionsClosed: false, votingClosed: true,
    });
    await performMutation("event.status", data({
      hackathonId: event.id, original: JSON.stringify({ status: "ACTIVE" }), status: "ENDED",
    }), people[0]);
    expect(await db.hackathon.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({
      status: "ENDED", submissionsClosed: true, votingClosed: true,
    });
    expect(await joinInvitedHackathon(event.id, people[4])).toBeNull();
  });

  it("previews a participant CSV and links imported participants to existing accounts only on save", async () => {
    const form = data({ hackathonId: eventId, preview: "on" });
    const csv = `email,name\n${people[0].email},Registered\n${people[4].email},New account\nNEW@example.test,New invite\nnew@example.test,Repeated`;
    form.set("file", new File([csv], "participants.csv", { type: "text/csv" }));
    const preview = await performMutation("participants.import", form, people[0]);
    expect(preview.message).toContain("2 new, 1 already registered, 1 duplicate, 0 invalid");
    expect(await db.participant.count({ where: { hackathonId: eventId } })).toBe(4);
    form.delete("preview");
    await performMutation("participants.import", form, people[0]);
    const added = await db.participant.findMany({ where: { hackathonId: eventId, normalizedEmail: { in: [people[4].email, "new@example.test"] } } });
    expect(added).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "New account", userId: people[4].id }),
      expect.objectContaining({ name: "New invite", userId: null }),
    ]));
    form.set("file", new File(["valid@example.test\ninvalid@"], "invalid.csv"));
    await expect(performMutation("participants.import", form, people[0])).rejects.toThrow("Fix 1 invalid");
    expect(await db.participant.count({ where: { hackathonId: eventId } })).toBe(6);
  });

  it("corrects an unclaimed participant's email and restores access to a revoked registration", async () => {
    await performMutation("participants.create", data({ hackathonId: eventId, email: " First@Example.Test ", name: "First" }), people[0]);
    const member = await db.participant.findFirstOrThrow({ where: { hackathonId: eventId, normalizedEmail: "first@example.test" } });
    const registration = { hackathonId: eventId, participantId: member.id };
    await performMutation("participants.update", data({
      ...registration, original: JSON.stringify({ name: "First", email: member.normalizedEmail }), name: "Corrected", email: people[4].email,
    }), people[0]);
    expect(await findParticipant(eventId, people[4].id, people[4].email)).toMatchObject({ id: member.id, name: "Corrected", userId: people[4].id });
    await performMutation("participants.remove", data(registration), people[0]);
    expect(await findParticipant(eventId, people[4].id, people[4].email)).toBeNull();
    await performMutation("participants.restore", data(registration), people[0]);
    expect(await findParticipant(eventId, people[4].id, people[4].email)).toMatchObject({ id: member.id, revokedAt: null });
  });

  it("allows reinvitation after a decline and lets the owner dissolve an empty team", async () => {
    const owner = people[1];
    const teammate = people[2];
    const team = await teamFor(owner);
    const member = await db.participant.findFirstOrThrow({ where: { hackathonId: eventId, userId: teammate.id } });
    const invite = () => performMutation("team.invite", data({ teamId: team.id, email: teammate.email }), owner);
    await invite();
    const invitation = await db.teamInvitation.findFirstOrThrow({ where: { teamId: team.id, participantId: member.id } });
    const respond = (response: string) => performMutation("invitation.respond", data({ invitationId: invitation.id, response }), teammate);
    await respond("decline");
    expect(await db.teamInvitation.findUnique({ where: { id: invitation.id } })).toMatchObject({ status: "DECLINED" });
    await invite();
    await respond("accept");
    expect(await db.participant.findUnique({ where: { id: member.id } })).toMatchObject({ teamId: team.id });
    await expect(performMutation("team.leave", data({ teamId: team.id }), owner)).rejects.toThrow("Remove the other members");
    await performMutation("team.remove", data({ teamId: team.id, participantId: member.id }), owner);
    expect(await db.participant.findUnique({ where: { id: member.id } })).toMatchObject({ teamId: null });
    await performMutation("team.leave", data({ teamId: team.id }), owner);
    expect(await db.team.findUnique({ where: { id: team.id } })).toBeNull();
  });

  it("keeps a moderated project hidden when its team edits and restores it only on organizer request", async () => {
    const contributor = people[1];
    const project = await projectFor(contributor);
    const track = await db.track.create({ data: { hackathonId: eventId, name: "Open" } });
    const moderate = (status: string) => performMutation("project.moderate", data({ projectId: project.id, status }), people[0]);
    await moderate("HIDDEN");
    const hidden = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(hidden.status).toBe("HIDDEN");
    expect((await findPublicEvent("test-build"))?._count.projects).toBe(0);
    const form = data({
      hackathonId: eventId, teamId: hidden.teamId, name: "Refined demo", description: hidden.description,
      videoUrl: hidden.videoUrl!, githubUrl: hidden.githubUrl!, expectedUpdatedAt: hidden.updatedAt.toISOString(),
      trackIds: [track.id, track.id],
    });
    await performMutation("project.save", form, contributor);
    const edited = await db.project.findUniqueOrThrow({ where: { id: hidden.id }, include: { tracks: true } });
    expect(edited).toMatchObject({ status: "HIDDEN", publishedAt: project.publishedAt, name: "Refined demo", tracks: [{ trackId: track.id }] });
    await moderate("SUBMITTED");
    expect((await findPublicEvent("test-build"))?._count.projects).toBe(1);
  });

  it("saves credit offers in local event time and preserves existing inventory on repeat uploads", async () => {
    await performMutation("credits.offer.save", data({ hackathonId: eventId, name: "Builder credits" }), people[0]);
    const offer = await db.creditOffer.findFirstOrThrow({ where: { hackathonId: eventId } });
    const original = offerEditValues(offer, "Asia/Singapore");
    await performMutation("credits.offer.save", data({
      ...original, hackathonId: eventId, id: offer.id, original: JSON.stringify(original),
      expiresAt: "2030-06-21T08:00", redemptionUrl: "https://example.test/redeem",
    }), people[0]);
    expect(await db.creditOffer.findUniqueOrThrow({ where: { id: offer.id } })).toMatchObject({
      expiresAt: new Date("2030-06-21T00:00:00Z"), redemptionUrl: "https://example.test/redeem",
    });
    const upload = data({ offerId: offer.id, codes: "UNIQUE-1\nUNIQUE-2\nUNIQUE-2", preview: "on" });
    expect((await performMutation("credits.import", upload, people[0])).message).toContain("2 new vouchers, 0 already uploaded, 1 duplicate");
    expect(await db.creditVoucher.count({ where: { offerId: offer.id } })).toBe(0);
    upload.delete("preview");
    await performMutation("credits.import", upload, people[0]);
    expect((await performMutation("credits.import", upload, people[0])).message).toContain("0 unique vouchers uploaded");
    expect(await db.creditVoucher.count({ where: { offerId: offer.id } })).toBe(2);
  });

  it("allows a team to form below the minimum but requires the exact roster before publishing", async () => {
    await db.hackathon.update({ where: { id: eventId }, data: { minTeamSize: 2, maxTeamSize: 2 } });
    const team = await teamFor(people[1]);
    const fields = { hackathonId: eventId, teamId: team.id, name: "Pair project", description: "Pair demo", videoUrl: "https://example.com/demo", githubUrl: "https://github.com/community/project", publish: "true", consent: "on" };
    await expect(performMutation("project.save", data(fields), people[1])).rejects.toThrow("at least 2 members");
    await db.participant.updateMany({ where: { hackathonId: eventId, userId: people[2].id }, data: { teamId: team.id } });
    fields.videoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    await performMutation("project.save", data(fields), people[1]);
    expect(await db.project.findUnique({ where: { teamId: team.id } })).toMatchObject({ status: "SUBMITTED" });
  });

  it("rejects organizer limits that conflict with existing rosters, votes, or project tracks", async () => {
    const project = await projectFor(people[1]);
    const otherTeam = await teamFor(people[2]);
    await db.participant.updateMany({ where: { hackathonId: eventId, userId: people[3].id }, data: { teamId: otherTeam.id } });
    await performMutation("vote.add", data({ projectId: project.id }), people[4]);
    const event = await db.hackathon.update({ where: { id: eventId }, data: { maxTrackSelections: 2 } });
    const tracks = await Promise.all(["Climate", "Payments"].map((name, position) =>
      db.track.create({ data: { hackathonId: eventId, name, position } }),
    ));
    await db.projectTrack.createMany({ data: tracks.map(track => ({ trackId: track.id, projectId: project.id })) });
    const original = eventEditValues(event, tracks);
    const save = (fields: Record<string, string>) => performMutation("event.save", data({
      ...original, id: eventId, original: JSON.stringify(original), title: "Must roll back", ...fields,
    }), people[0]);
    await expect(save({ maxTeamSize: "1" })).rejects.toThrow("team limit is smaller");
    await expect(save({ minTeamSize: "2" })).rejects.toThrow("minimum exceeds");
    await expect(save({ votesPerUser: "0" })).rejects.toThrow("votes already cast");
    await expect(save({ maxTrackSelections: "1" })).rejects.toThrow("existing project's selections");
    await expect(save({ tracks: "[]" })).rejects.toThrow("used by a project");
    await expect(save({ resources: "[" })).rejects.toThrow("valid list");
    const saved = await db.hackathon.findUniqueOrThrow({ where: { id: eventId } });
    expect(saved).toMatchObject({ title: event.title, minTeamSize: 1, votesPerUser: 1, maxTrackSelections: 2 });
    expect(await db.track.count({ where: { hackathonId: eventId } })).toBe(2);
  });

  it("only accepts one simultaneous invitation into the final team seat", async () => {
    const team = await teamFor(people[0]);
    const invited = await db.participant.findMany({ where: { hackathonId: eventId, userId: { in: [people[1].id, people[2].id] } } });
    const invitations = await Promise.all(invited.map(member => db.teamInvitation.create({ data: { teamId: team.id, participantId: member.id } })));
    const results = await Promise.allSettled(invitations.map(invitation => {
      const member = invited.find(item => item.id === invitation.participantId)!;
      const person = people.find(item => item.id === member.userId)!;
      return performMutation("invitation.respond", data({ invitationId: invitation.id, response: "accept" }), person);
    }));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await db.participant.count({ where: { teamId: team.id } })).toBe(2);
  }, 30_000);

  it("enforces a visitor's quota under concurrent votes and restores it on withdrawal", async () => {
    const first = await projectFor(people[1], "First project");
    const second = await projectFor(people[2], "Second project");
    const visitor = people[4];
    const results = await Promise.allSettled([first, second].map(project => performMutation("vote.add", data({ projectId: project.id }), visitor)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const ballots = await db.vote.findMany({ where: { userId: visitor.id } });
    expect(ballots).toHaveLength(1);
    await Promise.all([1, 2].map(() => performMutation("vote.withdraw", data({ projectId: ballots[0].projectId }), visitor)));
    expect(await db.vote.count({ where: { userId: visitor.id } })).toBe(0);
    await Promise.all([1, 2].map(() => performMutation("vote.add", data({ projectId: first.id }), visitor)));
    expect(await db.vote.count({ where: { userId: visitor.id } })).toBe(1);
    await expect(performMutation("vote.add", data({ projectId: first.id }), people[1])).rejects.toThrow("own team's project");
  }, 30_000);

  it("uses the current roster identity when checking a non-contributor's vote", async () => {
    const project = await projectFor(people[1]);
    const visitor = people[4];
    const ballot = data({ projectId: project.id });
    const rosterEntry = await db.participant.create({
      data: { hackathonId: eventId, teamId: project.teamId, normalizedEmail: visitor.email },
    });
    await expect(performMutation("vote.add", ballot, visitor)).rejects.toThrow("own team's project");

    const other = await db.user.create({ data: { email: "new-address@example.test" } });
    await db.participant.update({ where: { id: rosterEntry.id }, data: { userId: other.id } });
    await performMutation("vote.add", ballot, visitor);
    expect(await db.vote.count({ where: { userId: visitor.id, projectId: project.id } })).toBe(1);

    await db.project.update({ where: { id: project.id }, data: { status: "HIDDEN" } });
    await performMutation("vote.withdraw", ballot, visitor);
    expect(await db.vote.count({ where: { userId: visitor.id } })).toBe(0);
  });

  it("locks submitted rosters and keeps drafts private until explicit consent", async () => {
    const team = await teamFor(people[1]);
    await db.participant.update({ where: { hackathonId_userId: { hackathonId: eventId, userId: people[2].id } }, data: { teamId: team.id } });
    await performMutation("project.save", data({ hackathonId: eventId, teamId: team.id, name: "Draft" }), people[1]);
    const draft = await db.project.findUniqueOrThrow({ where: { teamId: team.id } });
    expect(draft.status).toBe("DRAFT");
    const submission = { hackathonId: eventId, teamId: team.id, expectedUpdatedAt: draft.updatedAt.toISOString(), name: "Published", description: "What it does", videoUrl: "https://youtu.be/dQw4w9WgXcQ", githubUrl: "https://github.com/community/project", publish: "true" };
    await expect(performMutation("project.save", data(submission), people[1])).rejects.toThrow("Agree to publish");
    await performMutation("project.save", data({ ...submission, consent: "on" }), people[1]);
    await expect(performMutation("project.save", data({ ...submission, name: "Old draft", publish: "false" }), people[2])).rejects.toThrow("changed since you opened");
    expect(await db.project.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({ name: "Published", status: "SUBMITTED" });
    expect((await db.team.findUniqueOrThrow({ where: { id: team.id } })).rosterLockedAt).not.toBeNull();
    await expect(performMutation("team.leave", data({ teamId: team.id }), people[1])).rejects.toThrow("roster was locked");
  }, 30_000);

  it("allocates vouchers once under concurrent calls and prevents cross-participant claims", async () => {
    const offer = await db.creditOffer.create({ data: { hackathonId: eventId, name: "Sponsor credits" } });
    await performMutation("credits.import", data({ offerId: offer.id, codes: "code\nUNIQUE-1\nUNIQUE-2\nUNIQUE-3\nUNIQUE-4" }), people[0]);
    await Promise.all([1, 2].map(() => performMutation("credits.assign", data({ offerId: offer.id }), people[0])));
    const vouchers = await db.creditVoucher.findMany({ where: { offerId: offer.id }, include: { participant: true } });
    expect(vouchers.filter(voucher => voucher.participantId)).toHaveLength(4);
    expect(new Set(vouchers.map(voucher => voucher.participantId)).size).toBe(4);
    const mine = vouchers.find(voucher => voucher.participant?.userId === people[1].id)!;
    await expect(performMutation("credits.claim", data({ voucherId: mine.id }), people[2])).rejects.toThrow("not assigned to you");
    await Promise.all([1, 2].map(() => performMutation("credits.claim", data({ voucherId: mine.id }), people[1])));
    const claimed = await db.creditVoucher.findUniqueOrThrow({ where: { id: mine.id } });
    expect(claimed.claimedAt).not.toBeNull();
    expect(decryptVoucher(claimed.encryptedValue)).toMatch(/^UNIQUE-/);
    expect(claimed.encryptedValue).not.toContain("UNIQUE-");
  }, 30_000);

  it("rolls back the entire allocation when inventory is short", async () => {
    const offer = await db.creditOffer.create({ data: { hackathonId: eventId, name: "Limited credits" } });
    await performMutation("credits.import", data({ offerId: offer.id, codes: "ONLY-ONE" }), people[0]);
    await expect(performMutation("credits.assign", data({ offerId: offer.id }), people[0])).rejects.toThrow("No assignments were changed");
    expect(await db.creditVoucher.count({ where: { offerId: offer.id, participantId: { not: null } } })).toBe(0);
  }, 30_000);

  it("assigns a voucher only to the selected participant when the same ID is submitted twice", async () => {
    const offer = await db.creditOffer.create({ data: { hackathonId: eventId, name: "Selected students" } });
    await performMutation("credits.import", data({ offerId: offer.id, codes: "CODE-A\nCODE-B" }), people[0]);
    const member = await db.participant.findFirstOrThrow({ where: { hackathonId: eventId, userId: people[1].id } });
    await performMutation("credits.assign", data({ offerId: offer.id, allocationMode: "selected", participantIds: [member.id, member.id] }), people[0]);
    const assigned = await db.creditVoucher.findMany({ where: { offerId: offer.id, participantId: { not: null } } });
    expect(assigned).toMatchObject([{ participantId: member.id }]);
    expect(await db.creditVoucher.count({ where: { offerId: offer.id, participantId: null } })).toBe(1);
  });

  it("keeps a returning Google identity and its revocation on the original registration", async () => {
    const person = people[1];
    const original = await db.participant.findUniqueOrThrow({
      where: { hackathonId_userId: { hackathonId: eventId, userId: person.id } },
    });
    const email = "renamed@example.test";
    const account = { type: "oauth" as const, provider: "google", providerAccountId: "returning-subject" };
    await db.account.create({ data: { ...account, userId: person.id } });
    const invitation = await db.participant.create({ data: { hackathonId: eventId, normalizedEmail: email } });
    const input = { user: person, account, profile: { sub: account.providerAccountId, email, email_verified: true } };

    expect(await authOptions.callbacks!.signIn!(input)).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: person.id } })).email).toBe(email);
    await authOptions.events!.signIn!({ ...input, isNewUser: false });
    expect((await findParticipant(eventId, person.id, email))?.id).toBe(original.id);
    expect((await db.participant.findUniqueOrThrow({ where: { id: invitation.id } })).userId).toBeNull();

    await performMutation("participants.remove", data({ hackathonId: eventId, participantId: original.id }), people[0]);
    await authOptions.events!.signIn!({ ...input, isNewUser: false });
    expect(await findParticipant(eventId, person.id, email)).toBeNull();
    await expect(teamFor({ ...person, email })).rejects.toThrow("not registered");
  }, 30_000);
});
