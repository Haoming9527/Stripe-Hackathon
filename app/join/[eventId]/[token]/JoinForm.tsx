"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";

function JoinButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="button button-primary"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Joining…" : "Join hackathon"}
      {pending ? (
        <span className="loading-spinner" aria-hidden="true" />
      ) : (
        <ArrowRight size={16} aria-hidden="true" />
      )}
    </button>
  );
}

export function JoinForm({
  action,
  afterSignIn,
}: {
  action: () => Promise<void>;
  afterSignIn: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  useEffect(() => {
    if (afterSignIn && !submitted.current) {
      submitted.current = true;
      form.current?.requestSubmit();
    }
  }, [afterSignIn]);
  return (
    <form ref={form} action={action}>
      <JoinButton />
    </form>
  );
}
