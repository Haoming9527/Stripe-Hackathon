"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SiteFrame({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isLanding = pathname === "/" || pathname === "/login";

  return (
    <>
      {header}
      <main id="main" className={isLanding ? "landing-main" : undefined}>
        {children}
      </main>
      {!isLanding && footer}
    </>
  );
}
