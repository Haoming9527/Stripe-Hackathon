"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { SINGAPORE_COMMUNITY_URL } from "@/lib/community";

export function SiteNavigation({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation" className="main-nav">
      <Link
        href="/hackathons"
        className="nav-link"
        aria-current={path.startsWith("/hackathons") ? "page" : undefined}
      >
        Hackathons
      </Link>
      <a
        href={SINGAPORE_COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="nav-link"
        aria-label="Singapore community"
      >
        Community <ArrowUpRight aria-hidden="true" size={13} />
      </a>
      {isAdmin && (
        <Link
          href="/admin"
          className="nav-link"
          aria-current={path.startsWith("/admin") ? "page" : undefined}
        >
          Admin
        </Link>
      )}
    </nav>
  );
}
