import "server-only";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { Viewer } from "@/lib/types";
import {
  emailIsAdmin,
  isConfiguredValue,
  normalizeIdentityEmail,
} from "@/lib/auth-policy";

const GOOGLE_SETTINGS = [
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "GOOGLE_ID",
  "GOOGLE_SECRET",
] as const;
export function missingAuthSettings(): string[] {
  return GOOGLE_SETTINGS.filter(
    (name) => !isConfiguredValue(process.env[name]),
  );
}

export function isAdminEmail(email: string): boolean {
  return emailIsAdmin(email, process.env.ADMIN_EMAILS);
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "database", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID ?? "",
      clientSecret: process.env.GOOGLE_SECRET ?? "",
      authorization: {
        params: { scope: "openid email profile", prompt: "select_account" },
      },
      profile(profile: GoogleProfile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: normalizeIdentityEmail(profile.email),
          image: profile.picture,
          emailVerified: profile.email_verified === true ? new Date() : null,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google" || !profile) return false;
      const google = profile as GoogleProfile;
      if (google.email_verified !== true || !google.email || !google.sub)
        return "/login?error=UnverifiedEmail";
      const email = normalizeIdentityEmail(google.email);
      try {
        const [existingAccount, emailOwner, viewer] = await Promise.all([
          prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId: google.sub,
              },
            },
            select: { userId: true },
          }),
          prisma.user.findUnique({ where: { email }, select: { id: true } }),
          getViewer(),
        ]);
        if (emailOwner && emailOwner.id !== existingAccount?.userId)
          return "/login?error=OAuthAccountNotLinked";
        if (viewer && viewer.id !== existingAccount?.userId)
          return "/login?error=SessionConflict";

        // Sessions derive roles from User.email. Persist Google's verified address
        // before NextAuth issues a session for a returning Google subject.
        if (existingAccount)
          await prisma.user.update({
            where: { id: existingAccount.userId },
            data: { email, emailVerified: new Date() },
          });
        return true;
      } catch {
        // NextAuth includes thrown callback messages in its error redirect.
        console.error("[auth] SIGN_IN_IDENTITY_CHECK_FAILED");
        return "/login?error=Configuration";
      }
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.email = user.email;
        session.user.isAdmin = user.email ? isAdminEmail(user.email) : false;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/") && !url.startsWith("//"))
        return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url;
      } catch {
        /* Untrusted redirects fall back to the application root. */
      }
      return baseUrl;
    },
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      if (account?.provider !== "google" || !profile?.email) return;
      const email = normalizeIdentityEmail(profile.email);
      if (isNewUser)
        await prisma.user.update({
          where: { id: user.id, email },
          data: { emailVerified: new Date() },
        });
      await prisma.participant.updateMany({
        where: {
          normalizedEmail: email,
          userId: null,
          hackathon: { participants: { none: { userId: user.id } } },
        },
        data: { userId: user.id },
      });
    },
  },
  logger: {
    error(code) {
      console.error(`[auth] ${code}`);
    },
    warn(code) {
      console.warn(`[auth] ${code}`);
    },
    debug() {
      /* OAuth tokens and provider payloads must never enter application logs. */
    },
  },
};

export async function getViewer(): Promise<Viewer | null> {
  if (missingAuthSettings().length) return null;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) return null;
  return {
    id: session.user.id,
    email: normalizeIdentityEmail(session.user.email),
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    isAdmin: isAdminEmail(session.user.email),
  };
}

export async function requireUser(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}
