import { afterEach, describe, expect, it, vi } from "vitest";
import { securityHeaders } from "../lib/security/headers";
import { auditSecurityEvent } from "../lib/security/audit";

afterEach(() => vi.restoreAllMocks());

describe("browser security headers", () => {
  it("sets framing, MIME and production transport protections", () => {
    const headers = Object.fromEntries(securityHeaders(true).map(({ key, value }) => [key, value]));
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["Strict-Transport-Security"]).toContain("max-age=");
    expect(securityHeaders(false).some(header => header.key === "Strict-Transport-Security")).toBe(false);
  });
});

describe("security audit logs", () => {
  it("records failures without arbitrary metadata or raw injected log lines", () => {
    const output = vi.spyOn(console, "warn").mockImplementation(() => {});
    auditSecurityEvent({ event: "mutation.rejected", actorId: "user-1", intent: "event.delete\nFORGED=secret" });
    const line = output.mock.calls[0][0] as string;
    expect(line).not.toContain("\n");
    expect(JSON.parse(line)).toMatchObject({ event: "mutation.rejected", actorId: "user-1", intent: "unknown" });
    expect(Object.keys(JSON.parse(line))).toEqual(["timestamp", "event", "actorId", "intent"]);
  });
});
