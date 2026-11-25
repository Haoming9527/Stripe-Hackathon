"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { performMutation } from "@/lib/domain";
import type { ActionState } from "@/lib/types";
import { DomainError } from "@/lib/validation";
import { auditSecurityEvent } from "@/lib/security/audit";
import { FEATURED_EVENT_TAG } from "@/lib/featured-event";

export async function submitAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const viewer = await requireUser();
  const intent = String(form.get("intent") ?? "");
  let result: { message: string; redirectTo?: string };
  try {
    result = await performMutation(
      intent,
      form,
      viewer,
    );
  } catch (error) {
    auditSecurityEvent({ event: error instanceof DomainError ? "mutation.rejected" : "mutation.failed", actorId: viewer.id, intent });
    // Only validation/domain errors are appropriate for the browser. Database
    // connection strings and provider responses must remain server-side.
    const message =
      error instanceof DomainError
        ? error.message
        : "We couldn’t save this change. Check the service configuration and try again.";
    return { success: false, message: message.slice(0, 500) };
  }
  if (viewer.isAdmin) auditSecurityEvent({ event: "mutation.succeeded", actorId: viewer.id, intent });
  if (["event.save", "event.delete", "event.status"].includes(intent)) updateTag(FEATURED_EVENT_TAG);
  revalidatePath("/", "layout");
  if (result.redirectTo) redirect(result.redirectTo);
  return { success: true, message: result.message };
}
