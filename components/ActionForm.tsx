"use client";

import { createContext, startTransition, useActionState, useContext, type ReactNode } from "react";
import { submitAction } from "@/lib/actions";
import type { ActionState } from "@/lib/types";

export const EditSavedContext = createContext<((message: string) => void) | null>(null);

function FormContents({
  children,
  pending,
}: {
  children: ReactNode;
  pending: boolean;
}) {
  return (
    <fieldset className="form-fieldset" disabled={pending} aria-busy={pending}>
      {children}
      {pending && (
        <span className="saving-status" role="status">
          Saving…
        </span>
      )}
    </fieldset>
  );
}

export function ActionForm({
  intent,
  children,
  className = "",
  successMessage,
}: {
  intent: string;
  children: ReactNode;
  className?: string;
  successMessage?: string;
}) {
  const onSaved = useContext(EditSavedContext);
  const [state, action, pending] = useActionState(async (previous: ActionState, data: FormData) => {
    const result = await submitAction(previous, data);
    if (result.success) onSaved?.(result.message);
    return result;
  }, {
    success: false,
    message: "",
  });
  return (
    <form
      action={action}
      className={className}
      onSubmit={(event) => {
        // React form actions reset uncontrolled inputs even when the server
        // returns validation errors. Dispatch explicitly to preserve edits.
        event.preventDefault();
        if (pending) return;
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(event.currentTarget, submitter);
        startTransition(() => action(data));
      }}
    >
      <input type="hidden" name="intent" value={intent} />
      <FormContents pending={pending}>{children}</FormContents>
      {state.message && (
        <div
          className={`notice ${state.success ? "notice-success" : "notice-error"}`}
          role={state.success ? "status" : "alert"}
        >
          {state.success ? successMessage || state.message : state.message}
        </div>
      )}
    </form>
  );
}

export default ActionForm;
