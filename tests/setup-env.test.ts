import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "node:util";
import { expect, it } from "vitest";

it("fills blank template secrets once and preserves existing settings", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "hackathon-setup-env-"));
  const file = path.join(cwd, ".env");
  const script = path.resolve("scripts/setup-env.mjs");
  try {
    const template = readFileSync(".env.example", "utf8").replace(
      'NEXTAUTH_SECRET=""',
      "NEXTAUTH_SECRET=  # generated locally",
    );
    writeFileSync(file, template);
    const run = () =>
      execFileSync(process.execPath, [script], { cwd, encoding: "utf8" });
    const output = run();
    const filled = readFileSync(file, "utf8");
    const env = parseEnv(filled);
    for (const key of ["NEXTAUTH_SECRET", "CREDITS_ENCRYPTION_KEY"]) {
      expect(Buffer.from(env[key] ?? "", "base64")).toHaveLength(32);
      expect(output).not.toContain(env[key]);
      expect(filled.split(`${key}=`)).toHaveLength(2);
    }
    expect(env.NEXTAUTH_SECRET).not.toBe(env.CREDITS_ENCRYPTION_KEY);
    expect(env.DATABASE_URL).toBe(parseEnv(template).DATABASE_URL);
    expect(filled).toContain("# generated locally");
    run();
    expect(readFileSync(file, "utf8")).toBe(filled);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
