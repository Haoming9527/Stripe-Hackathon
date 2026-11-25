import "server-only";
import { Prisma, type Hackathon } from "@prisma/client";
import { db } from "../db";
import { findParticipant } from "../queries";
import type { Viewer } from "../types";
import { assert, DomainError, field } from "../validation";

type Transaction = Prisma.TransactionClient;
export type MutationResult = { message: string; redirectTo?: string };

/** Serializable writes protect limits even when requests arrive concurrently. */
export async function serializable<T>(
  operation: (tx: Transaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 20_000,
      });
    } catch (error) {
      const failure = error as {
        code?: string;
        meta?: { code?: string };
      } | null;
      const conflict =
        failure?.code === "P2034" ||
        (failure?.code === "P2010" &&
          ["40001", "40P01"].includes(failure.meta?.code ?? ""));
      if (conflict && attempt < 3) continue;
      throw error;
    }
  }
  throw new DomainError(
    "Another update happened at the same time. Please try again.",
  );
}

export function admin(viewer: Viewer) {
  assert(viewer.isAdmin, "Administrator access is required.");
}

export function eventById(tx: Transaction, id: string): Promise<Hackathon>;
export function eventById<S extends Prisma.HackathonSelect>(
  tx: Transaction, id: string, select: S,
): Promise<Prisma.HackathonGetPayload<{ select: S }>>;
export async function eventById(tx: Transaction, id: string, select?: Prisma.HackathonSelect): Promise<object> {
  const event = await tx.hackathon.findUnique({ where: { id }, select });
  assert(event, "This hackathon could not be found.");
  return event;
}

export async function participant(
  tx: Transaction,
  hackathonId: string,
  viewer: Viewer,
) {
  const record = await findParticipant(hackathonId, viewer.id, viewer.email, tx);
  assert(
    record,
    "Your email is not registered for this hackathon.",
  );
  if (!record.userId)
    return tx.participant.update({
      where: { id: record.id, userId: null, revokedAt: null },
      data: { userId: viewer.id },
    });
  return record;
}

export function teamChangesAllowed(event: Pick<Hackathon, "status" | "submissionsClosed" | "submissionClosesAt">) {
  assert(
    event.status === "ACTIVE" &&
      !event.submissionsClosed &&
      new Date() < event.submissionClosesAt,
    "Team changes are closed for this hackathon.",
  );
}

export function rosterEditable(team: { rosterLockedAt: Date | null }) {
  assert(
    !team.rosterLockedAt,
    "This team's roster was locked when its project was published.",
  );
}

export async function importText(form: FormData, key: string): Promise<string> {
  const upload = form.get("file");
  if (upload && typeof upload !== "string" && upload.size > 0) {
    assert(upload.size <= 1_000_000, "Use a file smaller than 1 MB.");
    return upload.text();
  }
  return field(form, key, 1_000_000);
}
