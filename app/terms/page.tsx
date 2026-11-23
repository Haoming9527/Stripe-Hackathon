import type { Metadata } from "next";
import { PolicyDocument, type PolicySection } from "@/components/PolicyDocument";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using the Stripe Singapore Community Hackathons platform.",
};

const sections: PolicySection[] = [
  {
    id: "accounts-and-eligibility",
    title: "Accounts and eligibility",
    content: (
      <p>
        Use your own Google account to sign in and keep your sign-in credentials
        secure. Access to participant features depends on your event registration.
        Follow the organizer’s rules for eligibility, team membership, submission
        deadlines and voting.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    content: (
      <p>
        Use the platform lawfully and respect other participants. Misrepresenting
        your identity, manipulating votes, bypassing access controls or disrupting
        the platform violates these terms.
      </p>
    ),
  },
  {
    id: "project-submissions",
    title: "Project submissions",
    content: (
      <p>
        Submit only material that you have permission to share. By publishing a
        project, you authorize the platform to display its team name, project
        details and submitted media or links in the public gallery. Check that
        your submission is suitable for public viewing before publishing it.
      </p>
    ),
  },
  {
    id: "sponsor-credits",
    title: "Sponsor credits",
    content: (
      <p>
        Sponsor credit offers are subject to eligibility, availability and any
        claim deadline shown in the portal. Sponsors handle redemption under their
        own terms. Review the offer and the sponsor’s instructions before
        redeeming a code.
      </p>
    ),
  },
  {
    id: "event-support",
    title: "Event support",
    content: (
      <p>
        For questions about registration, participation or these terms, contact
        your hackathon organizer through the registration or invitation channel
        for your event.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <PolicyDocument
      title="Terms of Service"
      introduction="These terms apply when you use Stripe Singapore Community Hackathons to browse projects, vote or participate in a hackathon."
      sections={sections}
    />
  );
}
