import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
              <span className="sign-in-label">
                Sign in <ChevronRight aria-hidden="true" size={14} />
              </span>
              <svg
                aria-hidden="true"
                className="sign-in-cutout"
                viewBox="0 0 94 39"
                preserveAspectRatio="none"
                focusable="false"
              >
                <mask
                  id="sign-in-lettering"
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width="94"
                  height="39"
                >
                  <rect width="94" height="39" fill="white" />
                  <text x="16" y="24.5" fontSize="14" fill="black">
                    Sign in
                  </text>
                  <path
                    d="m70 16 3.5 3.5L70 23"
                    fill="none"
                    stroke="black"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </mask>
                <rect
                  width="94"
                  height="39"
                  rx="5"
                  fill="white"
                  mask="url(#sign-in-lettering)"
                />
              </svg>
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
