import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { mergeAdminEdit } from "./merge-admin-edit";
import { offerEditValues } from "../admin-edit";
import { decryptVoucher, encryptVoucher, voucherFingerprint } from "../credits";
import type { Viewer } from "../types";
import {
  assert,
  field,
  flag,
  parseLocalDateTime,
  parseVoucherValues,
  required,
  safeUrl,
} from "../validation";
import {
  admin,
  eventById,
  importText,
  participant,
  serializable,
  type MutationResult,
} from "./shared";

function voucherTable() {
  const connection =
    process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
  const schema = connection
    ? new URL(connection).searchParams.get("schema") || "public"
    : "public";
  // SQL identifiers cannot be bind parameters. Quote the configured schema,
  // doubling embedded quotes; no form or user input becomes SQL syntax.
  return Prisma.raw(`"${schema.replaceAll('"', '""')}"."CreditVoucher"`);
}

export async function saveCreditOffer(
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  admin(viewer);
  const hackathonId = required(form, "hackathonId", "a hackathon");
  const id = field(form, "id", 100);
  await serializable(async (tx) => {
    const event = await eventById(tx, hackathonId, { timezone: true });
    let values = form;
    if (id) {
      const existing = await tx.creditOffer.findUnique({ where: { id } });
      assert(
        existing?.hackathonId === hackathonId,
        "That credit offer belongs to another event.",
      );
      values = mergeAdminEdit(form, offerEditValues(existing, event.timezone));
    }
    const expiry = field(values, "expiresAt", 50);
    const data = {
      hackathonId,
      name: required(values, "name", "an offer name", 150),
      sponsor: field(values, "sponsor", 100),
      description: field(values, "description", 10_000),
      valueLabel: field(values, "valueLabel", 100),
      instructions: field(values, "instructions", 10_000),
      redemptionUrl: safeUrl(
        field(values, "redemptionUrl", 2048),
        "redemption URL",
        true,
      ),
      expiresAt: expiry
        ? parseLocalDateTime(expiry, event.timezone, "the credit expiry")
        : null,
    };
    if (id) await tx.creditOffer.update({ where: { id }, data, select: { id: true } });
    else await tx.creditOffer.create({ data, select: { id: true } });
  });
  return { message: "Credit offer saved." };
}

export async function importCredits(
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  admin(viewer);
  const offerId = required(form, "offerId", "a credit offer");
  const offer = await db.creditOffer.findUnique({ where: { id: offerId }, select: { id: true } });
  assert(offer, "This credit offer could not be found.");
  const result = parseVoucherValues(await importText(form, "codes"));
  assert(result.values.length, "Add at least one code or redemption link.");
  if (flag(form, "preview")) {
    const fingerprints = result.values.map(voucherFingerprint);
    const existing = await db.creditVoucher.count({ where: { offerId, fingerprint: { in: fingerprints } } });
    return {
      message: `Import preview: ${fingerprints.length - existing} new vouchers, ${existing} already uploaded, ${result.duplicates} duplicate entries.`,
    };
  }
  const inserted = await db.creditVoucher.createMany({
    data: result.values.map((value) => ({
      offerId, fingerprint: voucherFingerprint(value), encryptedValue: encryptVoucher(value),
    })),
    skipDuplicates: true,
  });
  return {
    message: `${inserted.count} unique vouchers uploaded. Existing vouchers were preserved.`,
  };
}

export async function assignCredits(
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  admin(viewer);
  const offerId = required(form, "offerId", "a credit offer");
  const participantIds = [
    ...new Set(form.getAll("participantIds").map((value) => String(value))),
  ];
  const allocationMode = field(form, "allocationMode", 20);
  assert(
    !allocationMode ||
      allocationMode === "all" ||
      allocationMode === "selected",
    "Choose who should receive this offer.",
  );
  assert(
    allocationMode !== "selected" || participantIds.length > 0,
    "Select at least one participant before assigning vouchers.",
  );
  const preview = flag(form, "preview");
  const result = await serializable(async (tx) => {
    const offer = await tx.creditOffer.findUnique({
      where: { id: offerId }, select: { hackathonId: true, expiresAt: true },
    });
    assert(offer, "This credit offer could not be found.");
    assert(
      !offer.expiresAt || offer.expiresAt > new Date(),
      "This credit offer has expired.",
    );
    const eligible = {
      hackathonId: offer.hackathonId, revokedAt: null,
      ...(participantIds.length ? { id: { in: participantIds } } : {}),
    };
    const total = await tx.participant.count({ where: eligible });
    assert(
      !participantIds.length || total === participantIds.length,
      "A selected participant is not eligible for this event.",
    );
    const unassigned = { ...eligible, vouchers: { none: { offerId } } };
    const inventory = { offerId, participantId: null, claimedAt: null };
    if (preview) {
      const needed = await tx.participant.count({ where: unassigned });
      const available = await tx.creditVoucher.count({ where: inventory });
      return { needed, available, assigned: total - needed };
    }
    const missing = await tx.participant.findMany({
      where: unassigned, select: { id: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const vouchers = missing.length ? await tx.creditVoucher.findMany({
      where: inventory, select: { id: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: missing.length,
    }) : [];
    assert(
      vouchers.length === missing.length,
      `Not enough vouchers: ${missing.length} needed, ${vouchers.length} available. No assignments were changed.`,
    );
    // Bulk updates keep large imports within the transaction timeout over a
    // remote database connection, while preserving all-or-nothing allocation.
    for (let offset = 0; offset < missing.length; offset += 1000) {
      const recipientsBatch = missing.slice(offset, offset + 1000);
      const assignments = Prisma.join(
        recipientsBatch.map(
          (recipient, index) =>
            Prisma.sql`(${vouchers[offset + index].id}::text, ${recipient.id}::text)`,
        ),
      );
      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE ${voucherTable()} AS voucher
        SET "participantId" = allocation."participantId", "assignedAt" = ${new Date()}
        FROM (VALUES ${assignments}) AS allocation(id, "participantId")
        WHERE voucher.id = allocation.id
          AND voucher."offerId" = ${offerId}
          AND voucher."participantId" IS NULL
          AND voucher."claimedAt" IS NULL
      `);
      assert(
        updated === recipientsBatch.length,
        "Inventory changed during allocation. No assignments were changed; try again.",
      );
    }
    return { needed: missing.length, assigned: total - missing.length, available: vouchers.length };
  });
  return {
    message: preview
      ? `Allocation preview: ${result.needed} needed, ${result.available} available, ${result.assigned} already assigned.${result.available < result.needed ? ` Upload ${result.needed - result.available} more vouchers before allocating.` : " Ready to allocate."}`
      : `${result.needed} vouchers assigned. ${result.assigned} existing assignments preserved.`,
  };
}

export async function claimCredit(
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  const id = required(form, "voucherId", "a voucher");
  await serializable(async (tx) => {
    const voucher = await tx.creditVoucher.findUnique({
      where: { id },
      select: {
        participantId: true, claimedAt: true, encryptedValue: true,
        offer: { select: { hackathonId: true, expiresAt: true } },
      },
    });
    assert(voucher?.participantId, "This voucher is not assigned to you.");
    const member = await participant(tx, voucher.offer.hackathonId, viewer);
    assert(
      voucher.participantId === member.id,
      "This voucher is not assigned to you.",
    );
    const event = await eventById(tx, voucher.offer.hackathonId, { status: true });
    assert(
      event.status !== "DRAFT",
      "Credits become available when the hackathon is published.",
    );
    assert(
      !voucher.offer.expiresAt || voucher.offer.expiresAt > new Date(),
      "This credit offer has expired.",
    );
    if (!voucher.claimedAt) {
      decryptVoucher(voucher.encryptedValue);
      await tx.creditVoucher.update({
        where: { id },
        data: { claimedAt: new Date() },
        select: { id: true },
      });
    }
  });
  return {
    message: "Credit claimed. Your redemption details are now available below.",
  };
}
