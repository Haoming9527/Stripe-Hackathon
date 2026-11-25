import Link from "next/link";
import "@/app/styles/portal.css";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { loadPortal } from "@/components/portal/data";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { OverviewTab } from "@/components/portal/OverviewTab";
import { TeamTab } from "@/components/portal/TeamTab";
import { SubmissionTab } from "@/components/portal/SubmissionTab";
import { CreditsTab } from "@/components/portal/CreditsTab";

export const dynamic = "force-dynamic";

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab: requestedTab } = await searchParams;
  const data = await loadPortal(slug, requestedTab);
  const { viewer, event } = data;
  if (!data.access)
    return (
      <div className="shell page-section">
        <div className="empty-state">
          <span className="empty-icon">
            <LockKeyhole size={26} />
          </span>
          <h1>Participant access required</h1>
          <p>
            You’re signed in as <strong>{viewer.email}</strong>.<br />
            This email isn’t on the participant list for {event.title}.<br />
            Ask the organizer to add it, or sign in with your invited email.
          </p>
          <Link href={`/hackathons/${slug}`} className="button button-primary">
            Explore the public gallery <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  const { tab } = data;
  const adminPreview = viewer.isAdmin && !data.participant;
  return (
    <>
      <PortalHeader
        adminPreview={adminPreview}
        event={event}
        viewer={viewer}
        tab={tab}
        hasInvitations={data.invitations.length > 0}
        hasCreditOffers={data.hasCreditOffers}
      />
      <section className="shell portal-content">
        {adminPreview && (
          <div className="notice">
            You&rsquo;re previewing this portal as an administrator. Import your own
            email to participate, create a team, or receive credits.
          </div>
        )}
        {tab === "overview" && (
          <OverviewTab
            event={data.event}
            team={data.team}
            submissionsOpen={data.submissionsOpen}
            now={data.now}
          />
        )}
        {tab === "team" && (
          <TeamTab
            event={data.event}
            team={data.team}
            viewer={data.viewer}
            participant={data.participant}
            canManageTeam={data.canManageTeam}
            teamsOpen={data.teamsOpen}
            invitations={data.invitations}
          />
        )}
        {tab === "submission" && (
          <SubmissionTab
            event={data.event}
            team={data.team}
            submissionsOpen={data.submissionsOpen}
            now={data.now}
          />
        )}
        {tab === "credits" && (
          <CreditsTab event={data.event} offers={data.offers} now={data.now} />
        )}
      </section>
    </>
  );
}
