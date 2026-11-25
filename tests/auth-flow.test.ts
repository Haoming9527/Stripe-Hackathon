import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  session: vi.fn(),
  prisma: {
    account: { findUnique: vi.fn() },
    hackathon: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    participant: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("next-auth", () => ({ getServerSession: fake.session }));
vi.mock("@next-auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("@/lib/db", () => ({ prisma: fake.prisma, db: fake.prisma }));

import { authOptions, getViewer } from "../lib/auth";
import { manageParticipant } from "../lib/domain/participants";
import { participant, serializable } from "../lib/domain/shared";
import { findParticipant } from "../lib/queries";

const googleAccount = {
  provider: "google",
  providerAccountId: "google-person",
  type: "oauth" as const,
};
const googleProfile = {
  sub: "google-person",
  email: "builder@example.com",
  email_verified: true,
  picture: "https://lh3.googleusercontent.com/example-avatar",
};
const input = () => ({
  user: { id: "new-profile", email: "builder@example.com" },
  account: googleAccount,
  profile: googleProfile,
});

beforeEach(() => {
  vi.resetAllMocks();
  for (const key of [
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
    "GOOGLE_ID",
    "GOOGLE_SECRET",
  ])
    vi.stubEnv(key, "configured-value");
  vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
  fake.session.mockResolvedValue(null);
  fake.prisma.account.findUnique.mockResolvedValue(null);
  fake.prisma.user.findUnique.mockResolvedValue(null);
  fake.prisma.user.update.mockResolvedValue({});
  fake.prisma.participant.updateMany.mockResolvedValue({ count: 0 });
  fake.prisma.$transaction.mockImplementation((operation) =>
    operation(fake.prisma),
  );
});

afterEach(() => vi.unstubAllEnvs());

describe("Google authentication callbacks", () => {
  it("denies unverified Google profiles before reading participant or user data", async () => {
    const unverifiedProfile = { ...googleProfile, email_verified: false };
    const result = await authOptions.callbacks!.signIn!({
      ...input(),
      profile: unverifiedProfile,
    });
    expect(result).toBe("/login?error=UnverifiedEmail");
    expect(fake.prisma.account.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an email owned by a different provider identity", async () => {
    fake.prisma.user.findUnique.mockResolvedValue({ id: "another-user" });
    expect(await authOptions.callbacks!.signIn!(input())).toBe(
      "/login?error=OAuthAccountNotLinked",
    );
  });

  it("does not link a fresh Google identity into an existing session", async () => {
    fake.session.mockResolvedValue({
      user: { id: "signed-in-user", email: "other@example.com" },
    });
    expect(await authOptions.callbacks!.signIn!(input())).toBe(
      "/login?error=SessionConflict",
    );
  });

  it("allows the existing canonical Google identity", async () => {
    fake.prisma.account.findUnique.mockResolvedValue({
      userId: "canonical-person",
    });
    fake.prisma.user.findUnique.mockResolvedValue({ id: "canonical-person" });
    expect(await authOptions.callbacks!.signIn!(input())).toBe(true);
  });

  it("persists the returning subject's verified address and photo before issuing a session", async () => {
    fake.prisma.account.findUnique.mockResolvedValue({
      userId: "canonical-person",
    });
    fake.session.mockResolvedValue({
      user: { id: "canonical-person", email: "admin@example.com" },
    });
    expect(await authOptions.callbacks!.signIn!(input())).toBe(true);
    expect(fake.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "canonical-person" },
      data: {
        email: googleProfile.email,
        emailVerified: expect.any(Date),
        image: googleProfile.picture,
      },
    });
    expect(fake.prisma.participant.updateMany).not.toHaveBeenCalled();
  });

  it.each(["lookup", "update"])(
    "rejects sign-in when the identity %s fails",
    async (stage) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("internal database diagnostic");
      fake.prisma.account.findUnique.mockResolvedValue({
        userId: "canonical-person",
      });
      if (stage === "lookup")
        fake.prisma.user.findUnique.mockRejectedValue(error);
      else fake.prisma.user.update.mockRejectedValue(error);
      expect(await authOptions.callbacks!.signIn!(input())).toBe(
        "/login?error=Configuration",
      );
    },
  );
});

describe("Google sessions", () => {
  it("registers only Google as a provider", () => {
    expect(authOptions.providers.map((provider) => provider.id)).toEqual([
      "google",
    ]);
  });
  it("links imported participants after Google authentication", async () => {
    await authOptions.events!.signIn!({
      user: { id: "canonical-person", email: "builder@example.com" },
      account: googleAccount,
      profile: { email: "builder@example.com" },
      isNewUser: false,
    });
    expect(fake.prisma.participant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          normalizedEmail: "builder@example.com",
          userId: null,
          hackathon: { participants: { none: { userId: "canonical-person" } } },
        },
        data: { userId: "canonical-person" },
      }),
    );
  });
  it("returns the canonical Google user in the session", async () => {
    fake.session.mockResolvedValue({
      user: {
        id: "canonical-person",
        email: "builder@example.com",
        name: "Builder",
        image: googleProfile.picture,
      },
    });
    expect(await getViewer()).toEqual({
      id: "canonical-person",
      email: "builder@example.com",
      name: "Builder",
      image: googleProfile.picture,
      isAdmin: false,
    });
  });
});

describe("registrations after a verified address change", () => {
  const viewer = {
    id: "canonical-person",
    email: googleProfile.email,
    name: null,
    image: null,
    isAdmin: false,
  };
  const linked = {
    id: "enrolled",
    hackathonId: "event",
    userId: viewer.id,
    normalizedEmail: "former@example.com",
    revokedAt: null,
  };

  it("resolves the linked registration for both the portal and mutations", async () => {
    fake.prisma.participant.findUnique.mockResolvedValue(linked);
    expect(await findParticipant("event", viewer.id, viewer.email)).toEqual(
      linked,
    );
    expect(
      await serializable((tx) => participant(tx, "event", viewer)),
    ).toEqual(linked);
    for (const [args] of fake.prisma.participant.findUnique.mock.calls) {
      expect(args.where).toEqual({
        hackathonId_userId: { hackathonId: "event", userId: viewer.id },
      });
    }
    expect(fake.prisma.participant.update).not.toHaveBeenCalled();
  });

  it("preserves revocation when a second invitation exists for the new email", async () => {
    fake.prisma.participant.findUnique.mockResolvedValue({
      ...linked,
      revokedAt: new Date(),
    });
    expect(await findParticipant("event", viewer.id, viewer.email)).toBeNull();
    await expect(
      serializable((tx) => participant(tx, "event", viewer)),
    ).rejects.toThrow("not registered");
    expect(fake.prisma.participant.findUnique).toHaveBeenCalledTimes(2);
    expect(fake.prisma.participant.update).not.toHaveBeenCalled();
  });

  it("only claims an active, unlinked invitation after looking up the account", async () => {
    fake.prisma.participant.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...linked,
        normalizedEmail: viewer.email,
        userId: null,
      });
    await serializable((tx) => participant(tx, "event", viewer));
    expect(fake.prisma.participant.findUnique).toHaveBeenNthCalledWith(2, {
      where: {
        hackathonId_normalizedEmail: {
          hackathonId: "event",
          normalizedEmail: viewer.email,
        },
        userId: null,
        revokedAt: null,
      },
    });
    expect(fake.prisma.participant.update).toHaveBeenCalledWith({
      where: { id: linked.id, userId: null, revokedAt: null },
      data: { userId: viewer.id },
    });
  });

  it("keeps the original participant identity when an organizer updates their name", async () => {
    fake.prisma.hackathon.findUnique.mockResolvedValue({ id: "event" });
    fake.prisma.participant.findUnique.mockResolvedValue(linked);
    fake.prisma.user.findUnique.mockResolvedValue({
      id: "new-holder-of-former-address",
    });
    const form = new FormData();
    for (const [key, value] of Object.entries({
      hackathonId: "event",
      participantId: linked.id,
      email: linked.normalizedEmail,
      name: "Updated",
      original: JSON.stringify({ name: "", email: linked.normalizedEmail }),
    }))
      form.set(key, value);
    await manageParticipant(form, { ...viewer, isAdmin: true }, "update");
    expect(fake.prisma.participant.update).toHaveBeenCalledWith({
      where: { id: linked.id },
      data: {
        normalizedEmail: linked.normalizedEmail,
        name: "Updated",
        userId: viewer.id,
      },
    });
  });
});
