"use client";

import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

export function NavigationIcon({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className="navigation-icon" aria-hidden="true">
        {pending ? <span className="loading-spinner" /> : children}
      </span>
      <span className="sr-only" role="status">{pending ? "Loading…" : ""}</span>
    </>
  );
}
