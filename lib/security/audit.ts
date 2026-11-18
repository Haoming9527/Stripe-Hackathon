import "server-only";

type SecurityEvent = {
  event: "mutation.succeeded" | "mutation.rejected" | "mutation.failed" | "export.denied" | "export.succeeded";
  actorId?: string;
  intent?: string;
};

const knownIntents = new Set([
  "event.save", "event.delete", "event.status", "event.windows",
  "participants.import", "participants.create", "participants.update", "participants.remove", "participants.restore",
  "team.create", "team.invite", "team.remove", "team.leave",
  "invitation.respond", "invitation.cancel", "project.save", "project.moderate", "vote.add", "vote.withdraw",
  "credits.offer.save", "credits.import", "credits.assign", "credits.claim", "participants", "votes",
]);

/** Structured operational logs: never include form data, email, tokens or errors. */
export function auditSecurityEvent({ event, actorId, intent }: SecurityEvent) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    actorId,
    // Never echo arbitrary form input into logs, even if it looks like an intent.
    intent: intent === undefined ? undefined : knownIntents.has(intent) ? intent : "unknown",
  };
  const message = JSON.stringify(entry);
  if (event.endsWith("failed")) console.error(message);
  else if (event.endsWith("rejected") || event.endsWith("denied")) console.warn(message);
  else console.info(message);
}
