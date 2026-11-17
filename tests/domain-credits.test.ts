import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { decryptVoucher, encryptVoucher, voucherFingerprint } from "../lib/credits";

const originalKey = process.env.CREDITS_ENCRYPTION_KEY;
beforeEach(() => { process.env.CREDITS_ENCRYPTION_KEY = "52".repeat(32); });
afterEach(() => {
  if (originalKey === undefined) delete process.env.CREDITS_ENCRYPTION_KEY;
  else process.env.CREDITS_ENCRYPTION_KEY = originalKey;
});

describe("credit secret storage", () => {
  it("round-trips a voucher without storing its plaintext and uses a fresh nonce", () => {
    const plaintext = "https://sponsor.example/claim/private-voucher-123";
    const first = encryptVoucher(plaintext);
    const second = encryptVoucher(plaintext);
    expect(first).not.toContain(plaintext);
    expect(first).not.toBe(second);
    expect(decryptVoucher(first)).toBe(plaintext);
    expect(voucherFingerprint(plaintext)).toBe(voucherFingerprint(plaintext));
  });

  it("rejects authenticated ciphertext after tampering", () => {
    const parts = encryptVoucher("PRIVATE-CODE").split(".");
    const ciphertext = Buffer.from(parts[3], "base64url");
    ciphertext[0] ^= 1;
    parts[3] = ciphertext.toString("base64url");
    expect(() => decryptVoucher(parts.join("."))).toThrow("could not be opened");
  });

  it("does not use a weak fallback encryption key", () => {
    process.env.CREDITS_ENCRYPTION_KEY = "replace-me";
    expect(() => encryptVoucher("CODE")).toThrow("CREDITS_ENCRYPTION_KEY");
  });
});
