"use client";

import { useEffect, useRef } from "react";

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
      <button className="button button-primary">Join hackathon</button>
    </form>
  );
}
