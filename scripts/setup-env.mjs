import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const destination = resolve(process.cwd(), ".env");
let source;
try { source = readFileSync(destination, "utf8"); } catch { source = ""; }
const keys = new Set([...source.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map(match => match[1]));
const defaults = {
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: randomBytes(32).toString("base64"),
  ADMIN_EMAILS: process.argv[2] || "admin@example.com",
  CREDITS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
};
const additions = Object.entries(defaults).filter(([key]) => !keys.has(key));
if (additions.length) {
  const lines = additions.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n");
  writeFileSync(destination, `${source.trimEnd()}\n\n# Hackathon platform settings\n${lines}\n`, { mode: 0o600 });
}
console.log(`Environment ready: ${additions.length} missing settings added; existing values preserved. Secret values were not displayed.`);
