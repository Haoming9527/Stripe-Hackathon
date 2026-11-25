import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getViewer, missingAuthSettings } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  participantInvitePath,
  validParticipantInvite,
} from "@/lib/participant-invite";
import { joinInvitedHackathon } from "@/lib/domain/participants";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { JoinForm } from "./JoinForm";

export const metadata = {
  title: "Participant invitation",
  robots: { index: false, follow: false },
};

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string; token: string }>;
  searchParams: Promise<{ signedIn?: string; denied?: string }>;
}) {
  const { eventId, token } = await params;
  if (!validParticipantInvite(eventId, token)) notFound();
  const event = await prisma.hackathon.findUnique({
    where: { id: eventId },
    select: { title: true, status: true },
  });
  if (!event) notFound();
  const path = participantInvitePath(eventId);
  const viewer = await getViewer();
  const query = await searchParams;

  async function join() {
    "use server";
    if (!validParticipantInvite(eventId, token)) notFound();
    const account = await getViewer();
    if (!account) redirect(path);
    const slug = await joinInvitedHackathon(eventId, account);
    if (!slug) redirect(path + "?denied=1");
    revalidatePath(`/admin/${eventId}`);
    redirect(`/hackathons/${slug}/portal`);
  }

  return (
    <section className="shell page-section">
      <div className="empty-state">
        <h1>Join {event.title}</h1>
        {event.status !== "ACTIVE" ? (
          <p>This hackathon is not currently accepting participants.</p>
        ) : query.denied ? (
          <p>
            Your account cannot join this hackathon. Contact the organizer for
            access.
          </p>
        ) : viewer ? (
          <>
            <p>Join as {viewer.email} to open your participant portal.</p>
            <JoinForm action={join} afterSignIn={query.signedIn === "1"} />
          </>
        ) : missingAuthSettings().length ? (
          <p>Sign-in is temporarily unavailable. Please try again later.</p>
        ) : (
          <>
            <p>
              Sign in to add your email to the participant list and open your
              portal.
            </p>
            <GoogleSignInButton
              callbackUrl={path + "?signedIn=1"}
              disabled={false}
              className="button button-primary"
            >
              Sign in with Google to join
            </GoogleSignInButton>
          </>
        )}
      </div>
    </section>
  );
}
