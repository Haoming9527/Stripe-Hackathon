import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isConfiguredValue } from "./auth-policy";

function signature(eventId: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!isConfiguredValue(secret))
    throw new Error("Sign-in configuration is required.");
  return createHmac("sha256", secret)
    .update("participant-invite:" + eventId)
    .digest("base64url");
}

export function participantInvitePath(eventId: string) {
  return `/join/${encodeURIComponent(eventId)}/${signature(eventId)}`;
}

export function validParticipantInvite(eventId: string, token: string) {
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(token) ||
    !isConfiguredValue(process.env.NEXTAUTH_SECRET)
  )
    return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(signature(eventId)));
}
