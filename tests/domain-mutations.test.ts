import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "../lib/types";

const mocked = vi.hoisted(() => {
  const methods = ["findUnique", "findMany", "count", "create", "createMany", "update", "updateMany", "delete", "deleteMany", "upsert", "groupBy"] as const;
  const models = ["hackathon", "participant", "team", "teamInvitation", "project", "projectTrack", "track", "vote", "creditOffer", "creditVoucher", "user"] as const;
  const delegates = Object.fromEntries(models.map(model => [model, Object.fromEntries(methods.map(method => [method, vi.fn()]))])) as Record<(typeof models)[number], Record<(typeof methods)[number], ReturnType<typeof vi.fn>>>;
  const tx = { ...delegates, $executeRaw: vi.fn() };
  return { tx, transaction: vi.fn() };
});

vi.mock("server-only", () => ({}));
vi.mock("../lib/db", () => ({ db: { ...mocked.tx, $transaction: mocked.transaction } }));

import { performMutation, serializable } from "../lib/domain";

const viewer: Viewer = { id: "user-1", email: "person@example.com", name: "Person", image: null, isAdmin: false };
const admin = { ...viewer, isAdmin: true };
const activeEvent = { id: "event-1", slug: "build", status: "ACTIVE", title: "Build", timezone: "Asia/Singapore", submissionsClosed: false, votingClosed: false, maxTeamSize: 2, maxTrackSelections: 1, votesPerUser: 3, submissionOpensAt: new Date(Date.now() - 60_000), submissionClosesAt: new Date(Date.now() + 60_000), votingOpensAt: new Date(Date.now() - 60_000), votingClosesAt: new Date(Date.now() + 60_000) };

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.transaction.mockImplementation(async operation => operation(mocked.tx));
  mocked.tx.hackathon.findUnique.mockResolvedValue(activeEvent);
});

describe("server authorization", () => {
  it.each(["participants.create", "participants.update", "participants.remove", "participants.restore", "event.delete"])("protects %s from non-admins", async intent => {
    await expect(performMutation(intent, form({ hackathonId: "event-1" }), viewer)).rejects.toThrow("Administrator");
    expect(mocked.transaction).not.toHaveBeenCalled();
  });

  it("rejects participant changes across hackathons", async () => {
    mocked.tx.participant.findUnique.mockResolvedValue({ id: "p", hackathonId: "other" });
    await expect(performMutation("participants.remove", form({ hackathonId: "event-1", participantId: "p" }), admin)).rejects.toThrow("not found");
    expect(mocked.tx.participant.update).not.toHaveBeenCalled();
  });

  it("preserves participant history while removing access and pending invitations", async () => {
    mocked.tx.participant.findUnique.mockResolvedValue({ id: "p", hackathonId: "event-1" });
    await performMutation("participants.remove", form({ hackathonId: "event-1", participantId: "p" }), admin);
    expect(mocked.tx.participant.update).toHaveBeenCalledWith({ where: { id: "p" }, data: { revokedAt: expect.any(Date) } });
    expect(mocked.tx.teamInvitation.updateMany).toHaveBeenCalledWith({ where: { participantId: "p", status: "PENDING" }, data: { status: "CANCELLED" } });
    expect(mocked.tx.participant.delete).not.toHaveBeenCalled();
  });

  it("prevents transferring an existing participant identity", async () => {
    mocked.tx.participant.findUnique.mockResolvedValue({ id: "p", hackathonId: "event-1", normalizedEmail: "old@example.com", userId: "u", _count: { vouchers: 0, invitations: 0 } });
    await expect(performMutation("participants.update", form({ hackathonId: "event-1", participantId: "p", email: "new@example.com" }), admin)).rejects.toThrow("Email cannot change");
    expect(mocked.tx.participant.update).not.toHaveBeenCalled();
  });

  it("requires exact confirmation before deleting a hackathon", async () => {
    await expect(performMutation("event.delete", form({ hackathonId: "event-1", confirmation: "wrong" }), admin)).rejects.toThrow("confirm deletion");
    expect(mocked.tx.hackathon.delete).not.toHaveBeenCalled();
  });

  it("deletes event-scoped dependent data and returns to admin", async () => {
    await expect(performMutation("event.delete", form({ hackathonId: "event-1", confirmation: "build" }), admin)).resolves.toMatchObject({ redirectTo: "/admin" });
    expect(mocked.tx.creditVoucher.deleteMany).toHaveBeenCalledWith({ where: { offer: { hackathonId: "event-1" } } });
    expect(mocked.tx.projectTrack.deleteMany).toHaveBeenCalledWith({ where: { project: { hackathonId: "event-1" } } });
    expect(mocked.tx.hackathon.delete).toHaveBeenCalledWith({ where: { id: "event-1" } });
    expect(mocked.tx.user.delete).not.toHaveBeenCalled();
  });
  it("rejects administrator mutations from ordinary users before reading protected data", async () => {
    await expect(performMutation("participants.import", form({ hackathonId: "event-1", emails: "x@example.com" }), viewer)).rejects.toThrow("Administrator");
    expect(mocked.tx.participant.count).not.toHaveBeenCalled();
  });

  it("does not let an unregistered user create a team", async () => {
    mocked.tx.hackathon.findUnique.mockResolvedValue(activeEvent);
    mocked.tx.participant.findUnique.mockResolvedValue(null);
    await expect(performMutation("team.create", form({ hackathonId: "event-1", name: "Team" }), viewer)).rejects.toThrow("not registered");
    expect(mocked.tx.team.create).not.toHaveBeenCalled();
  });

  it("does not let members invite as the owner", async () => {
    mocked.tx.team.findUnique.mockResolvedValue({ ownerId: "someone-else" });
    await expect(performMutation("team.invite", form({ teamId: "team-1", email: "friend@example.com" }), viewer)).rejects.toThrow("Only the team owner");
    expect(mocked.tx.teamInvitation.upsert).not.toHaveBeenCalled();
  });

  it("rejects another participant's voucher", async () => {
    mocked.tx.creditVoucher.findUnique.mockResolvedValue({ participantId: "person-2", offer: { hackathonId: "event-1", expiresAt: null } });
    mocked.tx.participant.findUnique.mockResolvedValue({ id: "person-1", userId: viewer.id, revokedAt: null });
    await expect(performMutation("credits.claim", form({ voucherId: "voucher-1" }), viewer)).rejects.toThrow("not assigned to you");
    expect(mocked.tx.creditVoucher.update).not.toHaveBeenCalled();
  });
});

describe("vote invariants", () => {
  it("blocks every contributor from self-voting even if membership data later changes", async () => {
    mocked.tx.project.findUnique.mockResolvedValue({ status: "SUBMITTED", hackathon: activeEvent, contributorIds: [viewer.id], team: { members: [] } });
    await expect(performMutation("vote.toggle", form({ projectId: "project-1" }), viewer)).rejects.toThrow("own team's project");
    expect(mocked.tx.vote.create).not.toHaveBeenCalled();
  });

  it("uses the same vote allowance for visitors and participants", async () => {
    mocked.tx.project.findUnique.mockResolvedValue({ status: "SUBMITTED", hackathonId: "event-1", hackathon: activeEvent, contributorIds: [], team: { members: [] } });
    mocked.tx.vote.findUnique.mockResolvedValue(null);
    mocked.tx.vote.count.mockResolvedValue(3);
    await expect(performMutation("vote.toggle", form({ projectId: "project-1" }), viewer)).rejects.toThrow("used all your votes");
    expect(mocked.tx.participant.findUnique).not.toHaveBeenCalled();
    expect(mocked.tx.vote.create).not.toHaveBeenCalled();
  });

  it("allows withdrawal at the allowance limit", async () => {
    mocked.tx.project.findUnique.mockResolvedValue({ status: "SUBMITTED", hackathon: activeEvent, contributorIds: [], team: { members: [] } });
    mocked.tx.vote.findUnique.mockResolvedValue({ id: "vote-1" });
    await expect(performMutation("vote.toggle", form({ projectId: "project-1" }), viewer)).resolves.toMatchObject({ message: expect.stringContaining("removed") });
    expect(mocked.tx.vote.delete).toHaveBeenCalledWith({ where: { id: "vote-1" } });
    expect(mocked.tx.vote.count).not.toHaveBeenCalled();
  });

  it("lets a voter withdraw an existing ballot after moderation hides the project", async () => {
    mocked.tx.project.findUnique.mockResolvedValue({ status: "HIDDEN", hackathon: activeEvent, contributorIds: [], team: { members: [] } });
    mocked.tx.vote.findUnique.mockResolvedValue({ id: "vote-hidden" });
    await expect(performMutation("vote.toggle", form({ projectId: "project-hidden" }), viewer)).resolves.toMatchObject({ message: expect.stringContaining("removed") });
    expect(mocked.tx.vote.delete).toHaveBeenCalledWith({ where: { id: "vote-hidden" } });
  });

  it("never accepts a new vote for a hidden project", async () => {
    mocked.tx.project.findUnique.mockResolvedValue({ status: "HIDDEN", hackathon: activeEvent, contributorIds: [], team: { members: [] } });
    mocked.tx.vote.findUnique.mockResolvedValue(null);
    await expect(performMutation("vote.toggle", form({ projectId: "project-hidden" }), viewer)).rejects.toThrow("not available for voting");
    expect(mocked.tx.vote.create).not.toHaveBeenCalled();
  });
});

describe("credit allocation", () => {
  it("never interprets an empty explicit selection as everyone", async () => {
    await expect(performMutation("credits.assign", form({ offerId: "offer-1", allocationMode: "selected" }), admin)).rejects.toThrow("Select at least one participant");
    expect(mocked.transaction).not.toHaveBeenCalled();
  });

  it("keeps allocation previews read-only", async () => {
    mocked.tx.creditOffer.findUnique.mockResolvedValue({ id: "offer-1", hackathonId: "event-1", expiresAt: null });
    mocked.tx.participant.findMany.mockResolvedValue([{ id: "person-1" }, { id: "person-2" }]);
    mocked.tx.creditVoucher.findMany.mockResolvedValue([]);
    mocked.tx.creditVoucher.count.mockResolvedValue(2);
    await expect(performMutation("credits.assign", form({ offerId: "offer-1", preview: "true" }), admin)).resolves.toMatchObject({ message: expect.stringContaining("Allocation preview") });
    expect(mocked.tx.$executeRaw).not.toHaveBeenCalled();
    expect(mocked.tx.creditVoucher.update).not.toHaveBeenCalled();
  });

  it("assigns different vouchers in a parameterized bulk update", async () => {
    mocked.tx.creditOffer.findUnique.mockResolvedValue({ id: "offer-1", hackathonId: "event-1", expiresAt: null });
    mocked.tx.participant.findMany.mockResolvedValue([{ id: "person-1" }, { id: "person-2" }]);
    mocked.tx.creditVoucher.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "voucher-1" }, { id: "voucher-2" }]);
    mocked.tx.creditVoucher.count.mockResolvedValue(2);
    mocked.tx.$executeRaw.mockResolvedValue(2);
    await expect(performMutation("credits.assign", form({ offerId: "offer-1" }), admin)).resolves.toMatchObject({ message: expect.stringContaining("2 vouchers assigned") });
    expect(mocked.tx.$executeRaw).toHaveBeenCalledTimes(1);
    const query = mocked.tx.$executeRaw.mock.calls[0][0];
    expect(query.values).toEqual(expect.arrayContaining(["voucher-1", "voucher-2", "person-1", "person-2", "offer-1"]));
    expect(mocked.tx.creditVoucher.update).not.toHaveBeenCalled();
  });

  it("rejects voucher claims while an event is still a draft", async () => {
    mocked.tx.hackathon.findUnique.mockResolvedValue({ ...activeEvent, status: "DRAFT" });
    mocked.tx.creditVoucher.findUnique.mockResolvedValue({ participantId: "person-1", offer: { hackathonId: "event-1", expiresAt: null } });
    mocked.tx.participant.findUnique.mockResolvedValue({ id: "person-1", userId: viewer.id, revokedAt: null });
    await expect(performMutation("credits.claim", form({ voucherId: "voucher-1" }), viewer)).rejects.toThrow("when the hackathon is published");
    expect(mocked.tx.creditVoucher.update).not.toHaveBeenCalled();
  });

  it("does not partially allocate when inventory is insufficient", async () => {
    mocked.tx.creditOffer.findUnique.mockResolvedValue({ id: "offer-1", hackathonId: "event-1", expiresAt: null });
    mocked.tx.participant.findMany.mockResolvedValue([{ id: "person-1" }, { id: "person-2" }]);
    mocked.tx.creditVoucher.findMany.mockResolvedValue([]);
    mocked.tx.creditVoucher.count.mockResolvedValue(1);
    await expect(performMutation("credits.assign", form({ offerId: "offer-1" }), admin)).rejects.toThrow("No assignments were changed");
    expect(mocked.tx.creditVoucher.update).not.toHaveBeenCalled();
  });

  it("treats repeated claims as idempotent", async () => {
    mocked.tx.creditVoucher.findUnique.mockResolvedValue({ participantId: "person-1", claimedAt: new Date(), offer: { hackathonId: "event-1", expiresAt: null } });
    mocked.tx.participant.findUnique.mockResolvedValue({ id: "person-1", userId: viewer.id, revokedAt: null });
    await expect(performMutation("credits.claim", form({ voucherId: "voucher-1" }), viewer)).resolves.toMatchObject({ message: expect.stringContaining("claimed") });
    expect(mocked.tx.creditVoucher.update).not.toHaveBeenCalled();
  });
});

describe("portal invitations", () => {
  it("blocks duplicate pending portal invitations", async () => {
    mocked.tx.team.findUnique.mockResolvedValue({ id: "team-1", ownerId: viewer.id, hackathonId: "event-1", hackathon: activeEvent, rosterLockedAt: null, _count: { members: 1 } });
    mocked.tx.participant.findUnique.mockResolvedValueOnce({ id: "person-1", userId: viewer.id, revokedAt: null }).mockResolvedValueOnce({ id: "person-2", teamId: null, revokedAt: null });
    mocked.tx.teamInvitation.findUnique.mockResolvedValue({ id: "invite-1", status: "PENDING" });
    await expect(performMutation("team.invite", form({ teamId: "team-1", email: "friend@example.com" }), viewer)).rejects.toThrow("already has a pending invitation");
    expect(mocked.tx.teamInvitation.upsert).not.toHaveBeenCalled();
  });
});

describe("submission consent", () => {
  it("does not publish without explicit consent", async () => {
    mocked.tx.hackathon.findUnique.mockResolvedValue(activeEvent);
    mocked.tx.participant.findUnique.mockResolvedValue({ id: "person-1", userId: viewer.id, teamId: "team-1", revokedAt: null });
    mocked.tx.team.findUnique.mockResolvedValue({ id: "team-1", hackathonId: "event-1", project: null, members: [{ userId: viewer.id }] });
    await expect(performMutation("project.save", form({ hackathonId: "event-1", name: "Project", description: "What it does", videoUrl: "https://youtu.be/abc", githubUrl: "https://github.com/team/project", publish: "true" }), viewer)).rejects.toThrow("Agree to publish");
    expect(mocked.tx.project.upsert).not.toHaveBeenCalled();
  });
});

describe("transaction conflicts", () => {
  it("retries serialization failures with a bounded attempt count", async () => {
    mocked.transaction.mockRejectedValueOnce({ code: "P2034" }).mockRejectedValueOnce({ code: "P2034" }).mockResolvedValue("saved");
    await expect(serializable(async () => "saved")).resolves.toBe("saved");
    expect(mocked.transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry unrelated database failures", async () => {
    mocked.transaction.mockRejectedValue({ code: "P2002" });
    await expect(serializable(async () => "saved")).rejects.toMatchObject({ code: "P2002" });
    expect(mocked.transaction).toHaveBeenCalledTimes(1);
  });

  it("retries PostgreSQL serialization failures reported by a raw bulk query", async () => {
    mocked.transaction.mockRejectedValueOnce({ code: "P2010", meta: { code: "40001" } }).mockResolvedValue("saved");
    await expect(serializable(async () => "saved")).resolves.toBe("saved");
    expect(mocked.transaction).toHaveBeenCalledTimes(2);
  });
});
