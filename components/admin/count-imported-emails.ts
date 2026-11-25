"use server";

import { prisma } from "@/lib/db";
import { isEmail } from "@/lib/validation";
import { requireAdmin } from "./access";

export async function countImportedEmails(hackathonId: string, emails: string[]): Promise<number> {
  await requireAdmin();
  if (
    typeof hackathonId !== "string" || !hackathonId ||
    !Array.isArray(emails) || emails.length > 5000 ||
    emails.some((email) => typeof email !== "string" || !isEmail(email))
  ) {
    throw new Error("Invalid participant import preview.");
  }
  return prisma.participant.count({ where: { hackathonId, normalizedEmail: { in: emails } } });
}
