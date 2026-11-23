import Link from "next/link";
import { CommunityLogo } from "@/components/CommunityLogo";
import { SiteNavigation } from "@/components/SiteNavigation";
import { getViewer, missingAuthSettings } from "@/lib/auth";
import { HeaderAuthButton } from "@/components/HeaderAuthButton";
import { AccountAvatar } from "@/components/AccountAvatar";

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link
          href="/"
          className="brand"
          aria-label="Stripe Community Hackathons home"
        >
          <CommunityLogo />
        </Link>
        <SiteNavigation isAdmin={Boolean(viewer?.isAdmin)} />
        <div className="header-account">
          {viewer ? (
            <div className="account-menu">
              <AccountAvatar
                email={viewer.email}
                name={viewer.name}
                image={viewer.image}
              />
              <HeaderAuthButton signedIn />
            </div>
          ) : (
            <HeaderAuthButton
              signedIn={false}
              disabled={missingAuthSettings().length > 0}
            />
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <Link href="/privacy">Privacy policy</Link>
        <Link href="/terms">Terms of service</Link>
        <a
          href="https://docs.stripe.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Developer resources
        </a>
      </div>
    </footer>
  );
}
