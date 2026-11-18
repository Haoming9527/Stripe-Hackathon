import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const destination = resolve(process.cwd(), ".env");
let source = "";
try {
  source = readFileSync(destination, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const existing = parseEnv(source);
const newline = source.includes("\r\n") ? "\r\n" : "\n";
const defaults = {
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: randomBytes(32).toString("base64"),
  ADMIN_EMAILS: process.argv[2] || "admin@example.com",
  CREDITS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
};
const additions = [];
let filled = 0;
for (const [key, value] of Object.entries(defaults)) {
  if (!Object.hasOwn(existing, key)) {
    additions.push(`${key}=${JSON.stringify(value)}`);
    continue;
  }
  if (key !== "NEXTAUTH_SECRET" && key !== "CREDITS_ENCRYPTION_KEY") continue;
  if (existing[key].trim()) continue;
  // Keep the template's position, line endings and trailing comments.
  const blank = new RegExp(
    `^([\\t ]*(?:export[\\t ]+)?${key}[\\t ]*=)[\\t ]*(?:"\\s*"|'\\s*')?(?=[\\t ]*(?:#|\\r?$))`,
    "gm",
  );
  const assignment = [...source.matchAll(blank)].at(-1);
  if (assignment) {
    const { index } = assignment;
    source =
      source.slice(0, index) +
      assignment[1] +
      JSON.stringify(value) +
      source.slice(index + assignment[0].length);
    filled++;
  } else {
    additions.push(`${key}=${JSON.stringify(value)}`);
  }
}
if (additions.length) {
  source += `${newline}# Hackathon platform settings${newline}${additions.join(newline)}${newline}`;
}
if (filled || additions.length)
  writeFileSync(destination, source, { mode: 0o600 });
console.log(
  `Environment setup complete. Added ${additions.length} settings and filled ${filled} empty secrets.`,
);
