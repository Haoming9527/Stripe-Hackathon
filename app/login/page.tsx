import Link from "next/link";
import type { Metadata } from "next";
import { getViewer, missingAuthSettings } from "@/lib/auth";
import { safeCallbackPath } from "@/lib/auth-policy";
import { getFeaturedEvent } from "@/lib/featured-event";
import { findParticipant } from "@/lib/queries";
import { ArrowRight } from "lucide-react";
import { CommunityGradient } from "@/components/CommunityGradient";
import { eventDate } from "@/lib/presentation";
import { LoginButtons, SignOutButton } from "./login-buttons";

export const metadata: Metadata = { title: "Sign in" };
export const revalidate = 0;

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
  const [query, viewer, featured] = await Promise.all([
    searchParams,
    getViewer(),
    getFeaturedEvent().catch(() => null),
  ]);
  const requested = safeCallbackPath(
    typeof query.callbackUrl === "string" ? query.callbackUrl : "/",
  );
  const member =
    requested === "/" && viewer && featured && !viewer.isAdmin
      ? await findParticipant(featured.id, viewer.id, viewer.email)
      : null;
  const destination = viewer?.isAdmin
    ? "/admin"
    : featured
      ? `/hackathons/${featured.slug}${!viewer || member ? "/portal" : ""}`
      : "/hackathons";
  const errorCode = typeof query.error === "string" ? query.error : "";
  const missing = missingAuthSettings();

  return (
    <section className="entry-hero" aria-labelledby="entry-title">
      <CommunityGradient />
      <div className="shell entry-grid">
        <div className="entry-copy">
          <h1 id="entry-title">{featured?.title ?? "Singapore hackathons"}</h1>
          {featured && (
            <p className="entry-event-details">
              <time dateTime={featured.startsAt}>
                {eventDate(featured.startsAt, featured.timezone)}
              </time>
              {featured.location && <span>{featured.location}</span>}
            </p>
          )}
          <p className="entry-intro">
            {viewer
              ? `Signed in as ${viewer.email}`
              : "Build with the Stripe community in Singapore. Sign in to join your team and submit your project."}
          </p>
          <div className="entry-controls" id="participant-access">
            {viewer ? (
              <>
                <Link
                  href={requested === "/" ? destination : requested}
                  className="entry-primary"
                >
                  {requested !== "/"
                    ? "Continue"
                    : viewer.isAdmin
                      ? "Manage hackathons"
                      : member
                        ? "Open your portal"
                        : "Explore hackathons"}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <SignOutButton />
              </>
            ) : (
              <LoginButtons
                callbackUrl={requested}
                googleEnabled={missing.length === 0}
              />
            )}
          </div>
          {errorCode && (
            <p role="alert" className="entry-message notice-error">
              {errors[errorCode] ??
                "Sign-in could not be completed. Please try again."}
            </p>
          )}
          {!viewer && missing.length > 0 && (
            <p className="entry-message" role="status">
              Sign-in is temporarily unavailable. Please try again later.
            </p>
          )}
          <Link href="/hackathons" className="entry-gallery-link">
            Browse the public galleries{" "}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
