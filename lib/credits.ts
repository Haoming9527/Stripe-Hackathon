import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { DomainError } from "./validation";

function encryptionKey(): Buffer {
  const value = process.env.CREDITS_ENCRYPTION_KEY ?? "";
  const key = /^[a-f\d]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");
  if (key.length !== 32)
    throw new DomainError(
      "Credit storage is not configured. Set CREDITS_ENCRYPTION_KEY to a 32-byte base64 or hex key.",
    );
  return key;
}

export function encryptVoucher(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptVoucher(value: string): string {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext)
    throw new DomainError(
      "This credit could not be opened. Contact the organizer.",
    );
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError(
      "This credit could not be opened. Contact the organizer.",
    );
  }
}

export function voucherFingerprint(value: string): string {
  return createHmac("sha256", encryptionKey()).update(value).digest("hex");
}
