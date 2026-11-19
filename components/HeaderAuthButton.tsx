"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { safeCallbackPath } from "@/lib/auth-policy";

export function HeaderAuthButton({
  signedIn,
  disabled,
}: {
  signedIn: boolean;
  disabled?: boolean;
}) {
  const maskId = useId();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const label = signedIn ? "Sign out" : "Sign in";
  async function authenticate() {
    setPending(true);
    setFailed(false);
    try {
      if (signedIn) {
        await signOut({ callbackUrl: "/" });
      } else {
        const { pathname, search } = window.location;
        const destination =
          pathname === "/login" || pathname === "/"
            ? new URLSearchParams(search).get("callbackUrl")
            : pathname + search;
        await signIn(
          "google",
          { callbackUrl: safeCallbackPath(destination) },
          { prompt: "select_account" },
        );
      }
    } catch {
      setFailed(true);
      setPending(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="header-sign-in"
        disabled={pending || disabled}
        onClick={authenticate}
      >
        <span className="sign-in-label">
          {label}
          {!signedIn && <ChevronRight aria-hidden="true" size={14} />}
        </span>
        <svg
          aria-hidden="true"
          className="sign-in-cutout"
          viewBox="0 0 94 39"
          preserveAspectRatio="none"
          focusable="false"
        >
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="94"
            height="39"
          >
            <rect width="94" height="39" fill="white" />
            <text
              x={signedIn ? 47 : 16}
              textAnchor={signedIn ? "middle" : "start"}
              y="24.5"
              fontSize="14"
              fill="black"
            >
              {label}
            </text>
            {!signedIn && (
              <path
                d="m70 16 3.5 3.5L70 23"
                fill="none"
                stroke="black"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </mask>
          <rect
            width="94"
            height="39"
            rx="5"
            fill="white"
            mask={`url(#${maskId})`}
          />
        </svg>
      </button>
      {failed && <span role="alert">Please try again.</span>}
    </>
  );
}
