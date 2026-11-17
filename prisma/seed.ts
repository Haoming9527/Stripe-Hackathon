import { PrismaClient } from "@prisma/client";
import { seedDemo } from "./demo-data";

// CLI entry point. Import demo-data.ts to use the fixture function directly.
async function main() {
  if (process.env.SEED_DEMO !== "true")
    throw new Error(
      "Set SEED_DEMO=true explicitly before running the development seed.",
    );
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seeding is disabled in production.");
  const prisma = new PrismaClient();
  try {
    const result = await seedDemo(prisma);
    console.log(
      `Demo data ready: /hackathons/${result.activeSlug} and /hackathons/${result.endedSlug}.`,
    );
    console.log(
      "Example identities cannot be used to sign in. No real codes, credentials, or votes were created.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (/(?:^|[\\/])prisma[\\/]seed\.(?:ts|js)$/.test(process.argv[1] ?? "")) {
  void main().catch(() => {
    console.error(
      "Demo seeding failed. Set SEED_DEMO=true, use a migrated development database, and check for conflicting demo IDs. Existing records are never overwritten.",
    );
    process.exitCode = 1;
  });
}
