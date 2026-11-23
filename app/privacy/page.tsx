import type { Metadata } from "next";
import { PolicyDocument, type PolicySection } from "@/components/PolicyDocument";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Stripe Singapore Community Hackathons handles personal data.",
};

const sections: PolicySection[] = [
  {
    id: "google-sign-in",
    title: "Google sign-in",
    content: (
      <>
        <p>
          When you sign in with Google, we receive your Google account identifier,
          name, verified email address and profile image URL. We use this
          information to create or recognize your account, match your verified
          email to event registrations and manage access to the platform.
        </p>
        <p>
          We store profile and linked account records, including OAuth tokens
          returned during sign-in, in the platform database. We use cookies
          and server-side session records to complete sign-in, keep you signed
          in and protect account access.
        </p>
      </>
    ),
  },
  {
    id: "event-information",
    title: "Event information",
    content: (
      <p>
        Organizers may provide your registration email and name. The platform
        records team membership and invitations, project submissions, votes, and
        sponsor credit assignments and claims. We use these records to administer
        events, check eligibility, enforce voting limits and manage credit claims.
        We record certain account and action details to investigate security and
        access issues.
      </p>
    ),
  },
  {
    id: "website-analytics",
    title: "Website analytics",
    content: (
      <p>
        We use Vercel Web Analytics to understand how visitors use the
        platform. It measures page views without using cookies and provides
        aggregate information about visited pages, referral sources, approximate
        location, browsers and devices.
      </p>
    ),
  },
  {
    id: "sharing-and-visibility",
    title: "Sharing and visibility",
    content: (
      <>
        <p>
          Authorized administrators can access records needed to run events,
          such as participant and voting records. Team members can see relevant
          member and invitation details in the participant portal. Hosting and
          database providers process information to operate the platform.
        </p>
        <p>
          Published gallery entries may display the team name, project description,
          tracks and submitted links. Entries may remain visible after an event
          ends. Embedded videos and external sites, including sponsor
          redemption pages, handle information under their own privacy policies.
        </p>
      </>
    ),
  },
  {
    id: "retention-and-requests",
    title: "Retention and privacy requests",
    content: (
      <>
        <p>
          <strong>
            We are committed to meeting our obligations under Singapore’s{" "}
            <a href="https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act">
              Personal Data Protection Act 2012 (PDPA)
            </a>
            .
          </strong>
        </p>
        <p>
          Sign-in sessions are configured to expire after seven days. Account,
          event and published project records are stored separately and may
          remain after your session expires or the event ends.
        </p>
        <p>
          To ask how long a record is kept, request access or correction, or
          request deletion, contact your hackathon organizer through the
          registration or invitation channel for your event. Include the event
          name and the email address you used to register or sign in.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <PolicyDocument
      title="Privacy Policy"
      introduction="This policy explains how Stripe Singapore Community Hackathons handles personal data when you browse the gallery, sign in or participate in an event."
      sections={sections}
    />
  );
}
