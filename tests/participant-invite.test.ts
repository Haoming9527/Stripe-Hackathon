import { afterEach, expect, it, vi } from "vitest";
import {
  participantInvitePath,
  validParticipantInvite,
} from "../lib/participant-invite";

afterEach(() => vi.unstubAllEnvs());

it("produces a invitation bound to one hackathon", () => {
  vi.stubEnv("NEXTAUTH_SECRET", "unit-test-signing-secret");
  const path = participantInvitePath("first");
  expect(participantInvitePath("first")).toBe(path);
  const token = path.split("/").pop()!;
  expect(validParticipantInvite("first", token)).toBe(true);
  expect(validParticipantInvite("second", token)).toBe(false);
  expect(validParticipantInvite("first", token.slice(1))).toBe(false);
});

it("rejects reusable invitation links when signing configuration is unavailable", () => {
  vi.stubEnv("NEXTAUTH_SECRET", "configured-secret");
  const token = participantInvitePath("event").split("/").at(-1)!;
  vi.stubEnv("NEXTAUTH_SECRET", "replace-with-a-secret");
  expect(validParticipantInvite("event", token)).toBe(false);
  expect(() => participantInvitePath("event")).toThrow("Sign-in configuration is required");
});
