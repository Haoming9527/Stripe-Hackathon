import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export async function migrateTestSchema(target: URL) {
  const schema = target.searchParams.get("schema");
  if (!schema || !/^hackathon_(test|e2e)_[a-f0-9]{32}$/.test(schema)) {
    throw new Error("Expected an isolated test schema.");
  }
  const source = path.resolve("prisma");
  const stage = await mkdtemp(path.join(tmpdir(), "hackathon-migrations-"));
  try {
    const migrations = path.join(stage, "migrations");
    await mkdir(migrations);
    await copyFile(
      path.join(source, "schema.prisma"),
      path.join(stage, "schema.prisma"),
    );
    await copyFile(
      path.join(source, "migrations/migration_lock.toml"),
      path.join(migrations, "migration_lock.toml"),
    );
    for (const entry of await readdir(path.join(source, "migrations"), {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) continue;
      const sql = await readFile(
        path.join(source, "migrations", entry.name, "migration.sql"),
        "utf8",
      );
      // Run Prisma's real migration history, including SQL with embedded semicolons.
      // Redirect the initial migration's explicit schema declaration to this run.
      const isolatedSql = sql.replace(
        /CREATE SCHEMA IF NOT EXISTS "public";/g,
        `CREATE SCHEMA IF NOT EXISTS "${schema}";`,
      );
      if (/(?:"public"|\bpublic)\s*\./i.test(isolatedSql)) {
        throw new Error(
          `Migration ${entry.name} explicitly targets the public schema.`,
        );
      }
      const folder = path.join(migrations, entry.name);
      await mkdir(folder);
      await writeFile(path.join(folder, "migration.sql"), isolatedSql);
    }
    const url = target.toString();
    await run(
      process.execPath,
      [
        path.resolve("node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
        "--schema",
        path.join(stage, "schema.prisma"),
      ],
      {
        env: { ...process.env, DATABASE_URL: url, DATABASE_URL_POOLED: url },
        windowsHide: true,
      },
    );
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
