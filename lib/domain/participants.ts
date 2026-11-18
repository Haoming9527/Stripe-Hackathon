import "server-only";
import { db } from "../db";
import type { Viewer } from "../types";
import {
  assert,
  field,
  flag,
  isEmail,
  normalizeEmail,
  parseParticipants,
  required,
} from "../validation";
import {
  admin,
  eventById,
  importText,
  serializable,
  type MutationResult,
} from "./shared";

export async function importParticipants(
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  admin(viewer);
  const hackathonId = required(form, "hackathonId", "a hackathon");
  const result = parseParticipants(await importText(form, "emails"));
  assert(result.participants.length, "Add at least one valid email address.");
  const existing = await db.participant.count({
    where: {
      hackathonId,
      normalizedEmail: {
        in: result.participants.map((item) => item.normalizedEmail),
      },
    },
  });
  const summary = `${result.participants.length - existing} new, ${existing} already registered, ${result.duplicates} duplicate, ${result.invalid.length} invalid.`;
  if (flag(form, "preview"))
    return {
      message: `Import preview: ${summary}${result.invalid.length ? ` Invalid: ${result.invalid.slice(0, 5).join(", ")}` : ""}`,
    };
  assert(
    result.invalid.length === 0,
    `Fix ${result.invalid.length} invalid email address(es) before importing: ${result.invalid.slice(0, 5).join(", ")}`,
  );
  await serializable(async (tx) => {
    await eventById(tx, hackathonId);
    const users = await tx.user.findMany({
      where: {
        email: { in: result.participants.map((item) => item.normalizedEmail) },
      },
      select: { id: true, email: true },
    });
    const userIds = new Map(users.map((user) => [user.email, user.id]));
    await tx.participant.createMany({
      data: result.participants.map((item) => ({
        ...item,
        hackathonId,
        userId: userIds.get(item.normalizedEmail) ?? null,
      })),
      skipDuplicates: true,
    });
  });
  return { message: `Participants imported. ${summary}` };
}

export async function manageParticipant(
  form: FormData,
  viewer: Viewer,
  operation: string,
): Promise<MutationResult> {
  admin(viewer);
  const hackathonId = required(form, "hackathonId", "a hackathon");
  await serializable(async (tx) => {
    await eventById(tx, hackathonId);
    const id =
      operation === "create"
        ? null
        : required(form, "participantId", "a participant");
    const member = id
      ? await tx.participant.findUnique({
          where: { id },
          include: {
            _count: { select: { vouchers: true, invitations: true } },
          },
        })
      : null;
    if (id)
      assert(
        member && member.hackathonId === hackathonId,
        "Participant not found in this hackathon.",
      );
    if (operation === "remove" || operation === "restore") {
      await tx.participant.update({
        where: { id: member!.id },
        data: { revokedAt: operation === "remove" ? new Date() : null },
      });
      if (operation === "remove")
        await tx.teamInvitation.updateMany({
          where: { participantId: member!.id, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
      return;
    }
    const normalizedEmail = normalizeEmail(
      required(form, "email", "an email address", 320),
    );
    assert(isEmail(normalizedEmail), "Enter a valid email address.");
    const name = field(form, "name", 120) || null;
    if (member && normalizedEmail !== member.normalizedEmail) {
      assert(
        !member.userId &&
          !member.teamId &&
          !member._count.vouchers &&
          !member._count.invitations,
        "Email cannot change after sign-in, team activity, or credit allocation. Remove this participant and add the correct email instead.",
      );
    }
    const duplicate = await tx.participant.findUnique({
      where: { hackathonId_normalizedEmail: { hackathonId, normalizedEmail } },
    });
    assert(
      !duplicate || duplicate.id === id,
      "This email is already registered. Restore the existing participant if removed.",
    );
    const user = await tx.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    const data = {
      name,
      normalizedEmail,
      userId: member?.userId ?? user?.id ?? null,
    };
    if (member) await tx.participant.update({ where: { id: member.id }, data });
    else await tx.participant.create({ data: { ...data, hackathonId } });
  });
  return {
    message:
      operation === "remove"
        ? "Participant removed. Event access revoked; team and credit history retained."
        : operation === "restore"
          ? "Participant access restored."
          : operation === "create"
            ? "Participant added."
            : "Participant updated.",
  };
}
