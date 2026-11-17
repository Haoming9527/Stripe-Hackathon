import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  session: vi.fn(),
  prisma: {
    account: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    participant: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("next-auth", () => ({ getServerSession: fake.session }));
vi.mock("@next-auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("@/lib/db", () => ({ prisma: fake.prisma }));

import { authOptions, getViewer } from "../lib/auth";

const googleAccount = {
  provider: "google",
  providerAccountId: "google-person",
  type: "oauth" as const,
};
const googleProfile = {
  sub: "google-person",
  email: "builder@example.com",
  email_verified: true,
};
const input = () => ({
  user: { id: "new-profile", email: "builder@example.com" },
  account: googleAccount,
  profile: googleProfile,
});

beforeEach(() => {
  vi.clearAllMocks();
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
          OR: [{ userId: null }, { userId: "canonical-person" }],
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
      },
    });
    expect(await getViewer()).toEqual({
      id: "canonical-person",
      email: "builder@example.com",
      name: "Builder",
      image: null,
      isAdmin: false,
    });
  });
});
