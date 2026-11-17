import Link from "next/link";
import type { Metadata } from "next";
import { getViewer, missingAuthSettings } from "@/lib/auth";
import { safeCallbackPath } from "@/lib/auth-policy";
import { listPublicEvents, findParticipant } from "@/lib/queries";
import { CommunityLogo } from "@/components/CommunityLogo";
import { LoginButtons, SignOutButton } from "./login-buttons";

export const metadata: Metadata = { title: "Sign in" };

const errors: Record<string, string> = {
  UnverifiedEmail:
    "Google must verify your email address before you can sign in.",
  OAuthAccountNotLinked:
    "Use the Google account you originally registered with.",
  SessionConflict: "Sign out before signing in with another Google account.",
  AccessDenied:
    "Sign-in was not completed. Please try again with a verified Google account.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const viewer = await getViewer();
  const events = await listPublicEvents().catch(() => []);
  const featured =
    events.find((event) => event.status === "ACTIVE") ?? events[0];
  const member =
    viewer && featured && !viewer.isAdmin
      ? await findParticipant(featured.id, viewer.id, viewer.email)
      : null;
  const destination = viewer?.isAdmin
    ? "/admin"
    : featured
      ? `/hackathons/${featured.slug}${!viewer || member ? "/portal" : ""}`
      : "/hackathons";
  const requested = safeCallbackPath(
    typeof query.callbackUrl === "string" ? query.callbackUrl : "/",
  );
  // Returning through the entry screen after Google login resolves admin and participant destinations.
  const callbackUrl = requested;
  const errorCode = typeof query.error === "string" ? query.error : "";
  const missing = missingAuthSettings();

  return (
    <section className="entry-page" aria-labelledby="entry-title">
      <div className="entry-panel">
        <CommunityLogo priority />
        <div className="entry-heading">
          <h1 id="entry-title">{featured?.title ?? "Singapore hackathons"}</h1>
          <p>
            {viewer
              ? `Signed in as ${viewer.email}`
              : "Build with the Stripe community in Singapore. Sign in to join your team and share your project."}
          </p>
        </div>
        {errorCode && (
          <p role="alert" className="notice notice-error">
            {errors[errorCode] ??
              "Sign-in could not be completed. Please try again."}
          </p>
        )}
        {viewer ? (
          <div className="entry-actions">
            <Link
              href={requested === "/" ? destination : requested}
              className="button button-primary login-provider"
            >
              {requested !== "/"
                ? "Continue"
                : viewer.isAdmin
                  ? "Manage hackathons"
                  : member
                    ? "Open your portal"
                    : "Explore hackathons"}
            </Link>
            <SignOutButton />
          </div>
        ) : (
          <LoginButtons
            callbackUrl={callbackUrl}
            googleEnabled={missing.length === 0}
          />
        )}
        {!viewer && missing.length > 0 && (
          <p className="notice" role="status">
            Sign-in is temporarily unavailable. Please try again later.
          </p>
        )}
        <Link href="/hackathons" className="entry-gallery-link">
          Browse the public galleries <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
