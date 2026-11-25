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
          href="https://github.com/Haoming9527/Stripe-Hackathon"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          Star on GitHub
        </a>
      </div>
    </footer>
  );
}
