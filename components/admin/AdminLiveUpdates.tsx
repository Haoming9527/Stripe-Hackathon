"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AdminLiveUpdates() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (pending) return;
    const refresh = () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        startTransition(() => router.refresh());
    };
    const interval = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [pending, router]);
  return null;
}
