"use client";

import { useState, type ReactNode } from "react";
import { safeCallbackPath } from "@/lib/auth-policy";

export function GoogleSignInButton({
  callbackUrl,
  disabled,
  className,
  children,
}: {
  callbackUrl?: string;
  disabled: boolean;
  className: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function continueWithGoogle() {
    setPending(true);
    setFailed(false);
    const { pathname, search, hash } = window.location;
    try {
      const { signIn } = await import("next-auth/react");
      await signIn(
        "google",
        {
          callbackUrl: safeCallbackPath(
            callbackUrl ?? pathname + search + hash,
          ),
        },
        { prompt: "select_account" },
      );
    } catch {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={pending || disabled}
        onClick={continueWithGoogle}
      >
        {pending ? "Opening Google…" : children}
      </button>
      {failed && (
        <p className="entry-message notice-error" role="alert">
          Sign-in could not start. Please try again.
        </p>
      )}
    </>
  );
}
