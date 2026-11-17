import Link from "next/link";
import { CommunityLogo } from "@/components/CommunityLogo";
import { SiteNavigation } from "@/components/SiteNavigation";
import { getViewer } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

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
              <span className="account-avatar" title={viewer.email}>
                {(viewer.name || viewer.email).slice(0, 1).toUpperCase()}
              </span>
              <SignOutButton />
            </div>
          ) : (
            <Link href="/login" className="header-sign-in">
              Sign in
            </Link>
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
