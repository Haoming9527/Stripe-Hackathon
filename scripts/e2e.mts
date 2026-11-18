import { randomBytes, randomUUID, createCipheriv, createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { migrateTestSchema } from "./test-migrations.mjs";

const root = process.cwd();
const schema = `hackathon_e2e_${randomUUID().replaceAll("-", "")}`;
const schemaPattern = /^hackathon_e2e_[a-f0-9]{32}$/;
const port = 3101;
const baseURL = `http://localhost:${port}`;
const encryptionKey = randomBytes(32);
let control: PrismaClient | undefined;
let db: PrismaClient | undefined;
let server: ChildProcess | undefined;
let suite: ChildProcess | undefined;
let schemaCreated = false;
let cleanupPromise: Promise<void> | undefined;

function encryptFixture(value: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

async function seedFixtures(client: PrismaClient) {
  const now = Date.now();
  const start = new Date(now - 3_600_000);
  const end = new Date(now + 86_400_000);
  const sessionEnv: Record<string, string> = {};
  for (const person of ["ADMIN", "BUILDER", "TEAMMATE", "VISITOR", "AUTHOR", "AUTHOR2", "DRAFTER", "VOTER"]) {
    const id = `e2e-${person.toLowerCase()}`;
    const email = `${person.toLowerCase()}@example.com`;
    await client.user.create({ data: { id, name: `${person[0]}${person.slice(1).toLowerCase()}`, email, emailVerified: new Date() } });
    if (["ADMIN", "BUILDER", "TEAMMATE", "VISITOR"].includes(person)) {
      const token = randomBytes(32).toString("hex");
      await client.session.create({ data: { sessionToken: token, userId: id, expires: end } });
      sessionEnv[`E2E_${person}_SESSION`] = token;
    }
  }
  await client.hackathon.create({ data: {
    id: "e2e-event", slug: "test-community-build", title: "Community browser test", tagline: "A space for ambitious ideas and the people who build them.",
    description: "Build something useful with your community. Form a team, turn your idea into a working project, and share it with everyone.",
    status: "ACTIVE", timezone: "Asia/Singapore", location: "Singapore", startsAt: start, endsAt: end,
    submissionOpensAt: start, submissionClosesAt: end, votingOpensAt: start, votingClosesAt: end,
    maxTeamSize: 2, votesPerUser: 1, maxTrackSelections: 1,
    attendeeInfo: "PRIVATE_ATTENDEE_TOKEN_e2e",
    schedule: [{ time: "09:30", label: "Meet the community" }, { time: "10:00", label: "Time to build" }, { time: "17:00", label: "Show what you made" }],
    resources: [{ title: "Stripe developer documentation", url: "https://docs.stripe.com" }],
    prizes: [{ title: "Community favorite", description: "Celebrate the most useful idea of the day." }],
    tracks: { create: [{ id: "e2e-track", name: "Commerce", description: "Make the internet economy work better." }] },
  } });
  for (const person of ["BUILDER", "TEAMMATE", "AUTHOR", "AUTHOR2", "DRAFTER"]) {
    await client.participant.create({ data: { id: `e2e-member-${person.toLowerCase()}`, hackathonId: "e2e-event", userId: `e2e-${person.toLowerCase()}`, normalizedEmail: `${person.toLowerCase()}@example.com` } });
  }
  const projectFixtures = [
    { id: "e2e-project", owner: "author", name: "Seeded public project", status: "SUBMITTED" as const, team: "Commerce collective" },
    { id: "e2e-project-two", owner: "author2", name: "Another community project", status: "SUBMITTED" as const, team: "Weekend builders" },
    { id: "e2e-draft", owner: "drafter", name: "Unpublished private draft", status: "DRAFT" as const, team: "Work in progress" },
  ];
  for (const project of projectFixtures) {
    const published = project.status === "SUBMITTED";
    await client.team.create({ data: { id: `${project.id}-team`, hackathonId: "e2e-event", ownerId: `e2e-${project.owner}`, name: project.team, rosterLockedAt: published ? start : null } });
    await client.participant.update({ where: { id: `e2e-member-${project.owner}` }, data: { teamId: `${project.id}-team` } });
    await client.project.create({ data: {
      id: project.id, teamId: `${project.id}-team`, hackathonId: "e2e-event", name: project.name, status: project.status,
      description: "A thoughtful prototype that helps small businesses spend less time managing payments and more time serving their customers.",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", githubUrl: "https://github.com/community/project", demoUrl: "https://example.com/demo",
      publishedAt: published ? start : null, consentAt: published ? start : null, consentUserId: published ? `e2e-${project.owner}` : null,
      contributorIds: published ? [`e2e-${project.owner}`] : [], tracks: { create: [{ trackId: "e2e-track" }] },
    } });
  }
  await client.vote.create({ data: { userId: "e2e-voter", hackathonId: "e2e-event", projectId: "e2e-project" } });
  await client.creditOffer.create({ data: {
    id: "e2e-offer", hackathonId: "e2e-event", name: "Builder API credits", sponsor: "Community partner", valueLabel: "US$100 in API credits",
    description: "A little extra room to experiment with your next idea.", instructions: "Copy your unique code and redeem it with the provider.",
    redemptionUrl: "https://example.com/redeem", expiresAt: end,
  } });
  const credit = "E2E-BUILDER-CREDIT-PRIVATE";
  await client.creditVoucher.create({ data: {
    id: "e2e-voucher", offerId: "e2e-offer", participantId: "e2e-member-builder", assignedAt: start,
    encryptedValue: encryptFixture(credit), fingerprint: createHmac("sha256", encryptionKey).update(credit).digest("hex"),
  } });
  await client.hackathon.create({ data: {
    id: "e2e-ended", slug: "last-community-build", title: "The last community build", tagline: "Good ideas live on. Explore what the community made together.",
    status: "ENDED", location: "Online", startsAt: new Date(now - 8 * 86_400_000), endsAt: new Date(now - 7 * 86_400_000),
    submissionOpensAt: new Date(now - 8 * 86_400_000), submissionClosesAt: new Date(now - 7 * 86_400_000),
    votingOpensAt: new Date(now - 7 * 86_400_000), votingClosesAt: new Date(now - 6 * 86_400_000),
  } });
  return sessionEnv;
}

async function ensurePortFree() {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () => reject(new Error(`Port ${port} is already in use. Stop that process before running browser tests.`)));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve()));
  });
}

async function stopProcess(child: ChildProcess | undefined) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      killer.once("error", () => { child.kill(); resolve(); });
      killer.once("exit", () => resolve());
    });
  } else {
    child.kill("SIGTERM");
    await Promise.race([new Promise<void>((resolve) => child.once("exit", () => resolve())), new Promise<void>((resolve) => setTimeout(resolve, 3000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

async function cleanup() {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    await stopProcess(suite);
    await stopProcess(server);
    try { await db?.$disconnect(); } catch { /* Still attempt schema cleanup if the client has already disconnected. */ }
    if (control && schemaCreated) {
      if (!schemaPattern.test(schema)) throw new Error("Refusing to clean up an unrecognized database schema.");
      await control.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      console.log("Removed the isolated browser-test schema.");
    }
    await control?.$disconnect();
  })();
  return cleanupPromise;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void cleanup().finally(() => process.exit(130)); });
}

async function run() {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw) throw new Error("Set TEST_DATABASE_URL explicitly to a direct PostgreSQL URL. This runner never falls back to the application database URL.");
  const target = new URL(raw);
  if (!/^postgres(?:ql)?:$/.test(target.protocol)) throw new Error("TEST_DATABASE_URL must be a PostgreSQL connection URL.");
  if (!schemaPattern.test(schema)) throw new Error("The generated test schema is invalid.");
  if (!existsSync(path.join(root, ".next", "BUILD_ID"))) throw new Error("Run npm run build before running browser tests.");
  await ensurePortFree();
  await mkdir(path.join(root, "artifacts"), { recursive: true });
  control = new PrismaClient({ datasourceUrl: raw });
  await control.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  schemaCreated = true;
  target.searchParams.set("schema", schema);
  target.searchParams.set("connection_limit", "5");
  const isolatedUrl = target.toString();
  db = new PrismaClient({ datasourceUrl: isolatedUrl });
  await migrateTestSchema(target);
  const sessions = await seedFixtures(db);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: isolatedUrl,
    DATABASE_URL_POOLED: isolatedUrl,
    NEXTAUTH_URL: baseURL,
    NEXTAUTH_SECRET: randomBytes(32).toString("hex"),
    CREDITS_ENCRYPTION_KEY: encryptionKey.toString("hex"),
    ADMIN_EMAILS: "admin@example.com",
    GOOGLE_ID: "e2e-local-client",
    GOOGLE_SECRET: "e2e-local-secret",
    NEXT_TELEMETRY_DISABLED: "1",
    E2E_BASE_URL: baseURL,
    ...sessions,
  };
  const testServer = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "--port", String(port), "--hostname", "127.0.0.1"], { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server = testServer;
  let serverOutput = "";
  testServer.stdout?.on("data", (data: Buffer) => { serverOutput = (serverOutput + data.toString()).slice(-4000); });
  testServer.stderr?.on("data", (data: Buffer) => { serverOutput = (serverOutput + data.toString()).slice(-4000); });
  testServer.on("error", () => { serverOutput = "The test server could not start."; });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (testServer.exitCode !== null) break;
    try {
      const response = await fetch(baseURL, { signal: AbortSignal.timeout(2000) });
      if (response.ok) { ready = true; break; }
    } catch { /* Wait for the test-owned server, never reuse another process. */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) {
    // The child may have logged a provider response or connection details; keep that output private.
    if (serverOutput.includes("EADDRINUSE")) throw new Error(`The browser-test server could not bind port ${port}.`);
    throw new Error("The isolated browser-test server did not become ready. Check the production build and test database access.");
  }
  console.log("Running browser tests against an isolated database schema on port 3101.");
  const testSuite = spawn(process.execPath, [path.join(root, "node_modules/@playwright/test/cli.js"), "test", "--config=playwright.config.ts", ...process.argv.slice(2)], { cwd: root, env, windowsHide: true, stdio: "inherit" });
  suite = testSuite;
  const code = await new Promise<number>((resolve, reject) => { testSuite.once("error", reject); testSuite.once("exit", (result) => resolve(result ?? 1)); });
  if (code !== 0) throw new Error(`Browser tests exited with code ${code}. See test-results/e2e for failure artifacts.`);
}

try {
  await run();
} catch (error) {
  const message = error instanceof Error && !/(postgres(?:ql)?:\/\/|password|connection string)/i.test(error.message) ? error.message : "The isolated browser test could not complete. Check its database configuration.";
  console.error(message);
  process.exitCode = 1;
} finally {
  try { await cleanup(); } catch { console.error(`Could not remove the isolated schema ${schema}. No application schema was modified.`); process.exitCode = 1; }
}
