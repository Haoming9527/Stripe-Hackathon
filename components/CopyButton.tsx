"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

export function CopyButton({
  value,
  share = false,
  label,
}: {
  value: string;
  share?: boolean;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        value.startsWith("/") ? `${window.location.origin}${value}` : value,
      );
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }
  return (
    <span className="copy-control">
      <button
        type="button"
        className="text-button"
        onClick={copy}
        aria-label={label ?? (share ? "Copy project link" : "Copy code")}
      >
        {copied ? (
          <Check size={16} />
        ) : share ? (
          <Share2 size={16} />
        ) : (
          <Copy size={16} />
        )}
        {copied ? "Copied" : label ?? (share ? "Share" : "Copy")}
      </button>
      {failed && <small role="alert">Select and copy the text manually.</small>}
    </span>
  );
}
