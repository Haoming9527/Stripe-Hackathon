import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "../lib/types";

const mocked = vi.hoisted(() => {
  const tx = {
    teamInvitation: { findUnique: vi.fn(), update: vi.fn() },
    participant: { findUnique: vi.fn() },
  };
  return { tx, transaction: vi.fn() };
});

vi.mock("server-only", () => ({}));
vi.mock("../lib/db", () => ({
  db: { ...mocked.tx, $transaction: mocked.transaction },
}));

import { performMutation } from "../lib/domain";

const viewer: Viewer = {
  id: "owner",
  email: "owner@example.test",
  name: "Owner",
  image: null,
  isAdmin: false,
};
function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.transaction.mockImplementation((operation) => operation(mocked.tx));
  mocked.tx.teamInvitation.findUnique.mockResolvedValue({
    id: "invite",
    status: "PENDING",
    participantId: "recipient",
    team: { ownerId: "owner", hackathonId: "event" },
  });
  mocked.tx.participant.findUnique.mockResolvedValue({
    id: "owner-participant",
    userId: viewer.id,
    revokedAt: null,
  });
});

describe("invitation command authorization", () => {
  it.each(["cancel", "ACCEPT", "unknown"])(
    "rejects response %s before accessing an invitation",
    async (response) => {
      await expect(
        performMutation(
          "invitation.respond",
          form({ invitationId: "invite", response }),
          viewer,
        ),
      ).rejects.toThrow("Choose accept or decline");
      expect(mocked.transaction).not.toHaveBeenCalled();
    },
  );

  it("keeps cancellation on the owner-authorized command", async () => {
    await performMutation(
      "invitation.cancel",
      form({ invitationId: "invite" }),
      viewer,
    );
    expect(mocked.tx.teamInvitation.update).toHaveBeenCalledWith({
      where: { id: "invite" },
      data: { status: "CANCELLED" },
    });
  });

  it("does not let a different user cancel by submitting the owner command", async () => {
    await expect(
      performMutation("invitation.cancel", form({ invitationId: "invite" }), {
        ...viewer,
        id: "other",
      }),
    ).rejects.toThrow("Only the team owner");
    expect(mocked.tx.teamInvitation.update).not.toHaveBeenCalled();
  });

  it("does not let a revoked owner cancel pending invitations", async () => {
    mocked.tx.participant.findUnique.mockResolvedValue({
      id: "owner-participant",
      userId: viewer.id,
      revokedAt: new Date(),
    });
    await expect(
      performMutation(
        "invitation.cancel",
        form({ invitationId: "invite" }),
        viewer,
      ),
    ).rejects.toThrow("not registered");
    expect(mocked.tx.teamInvitation.update).not.toHaveBeenCalled();
  });
});
