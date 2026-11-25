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
import { eventEditValues } from "../lib/admin-edit";
import { joinInvitedHackathon } from "../lib/domain/participants";
import { decryptVoucher } from "../lib/credits";
import { authOptions } from "../lib/auth";
import { findParticipant } from "../lib/queries";

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
