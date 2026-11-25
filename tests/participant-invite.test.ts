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
