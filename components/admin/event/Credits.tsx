import type { Hackathon } from "@prisma/client";
import { prisma } from "@/lib/db";
import OfferForm from "../OfferForm";
import { CreditAllocationForm, VoucherImportForm } from "../ImportForms";
import { eventDate } from "../format";
import styles from "../styles";

export async function Credits({ event }: { event: Hackathon }) {
  const [offers, participants] = await Promise.all([
    prisma.creditOffer.findMany({
      where: { hackathonId: event.id },
      orderBy: { createdAt: "asc" },
      include: {
        vouchers: {
          select: {
            id: true,
            participantId: true,
            assignedAt: true,
            claimedAt: true,
          },
        },
      },
    }),
    prisma.participant.findMany({
      where: { hackathonId: event.id, revokedAt: null },
      select: { id: true, normalizedEmail: true, name: true },
      orderBy: { normalizedEmail: "asc" },
    }),
  ]);
  const people = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  return (
    <>
      <div className={styles.callout} style={{ marginBottom: 22 }}>
        <strong>Give every builder a head start.</strong> Create an offer,
        upload its unique codes or links, then assign one per participant.
        Claiming reveals the voucher; external redemption is tracked by the
        sponsor.
      </div>
      {offers.map((offer) => {
        const assigned = offer.vouchers.filter(
          (voucher) => voucher.participantId,
        );
        const assignedIds = new Set(
          assigned.map((voucher) => voucher.participantId),
        );
        const available = offer.vouchers.length - assigned.length;
        const claimed = offer.vouchers.filter(
          (voucher) => voucher.claimedAt,
        ).length;
        return (
          <section key={offer.id} className={styles.section}>
            <div className={styles.creditHeader}>
              <div>
                <h3>{offer.name}</h3>
                <p>
                  {[offer.sponsor, offer.valueLabel]
                    .filter(Boolean)
                    .join(" · ") || "Participant credit offer"}
                </p>
              </div>
              {offer.expiresAt && (
                <span className={styles.subtle} style={{ marginLeft: "auto" }}>
                  Expires {eventDate(offer.expiresAt, event.timezone)}
                </span>
              )}
            </div>
            <div className={styles.creditMetrics}>
              <span>
                <strong>{available}</strong> available
              </span>
              <span>
                <strong>{assigned.length}</strong> assigned
              </span>
              <span>
                <strong>{claimed}</strong> claimed
              </span>
            </div>
            <div className={styles.creditBody}>
              <div className={styles.columns}>
                <div>
                  <h3 style={{ fontSize: 14, marginBottom: 18 }}>
                    1. Add inventory
                  </h3>
                  <VoucherImportForm offerId={offer.id} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, marginBottom: 18 }}>
                    2. Allocate to participants
                  </h3>
                  <CreditAllocationForm
                    offerId={offer.id}
                    available={available}
                    participants={participants.map((participant) => ({
                      ...participant,
                      assigned: assignedIds.has(participant.id),
                    }))}
                  />
                </div>
              </div>
            </div>
            <details className={styles.creditBody}>
              <summary
                style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                Allocation history ({assigned.length})
              </summary>
              <div className={styles.tableWrap} style={{ marginTop: 16 }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Participant</th>
                      <th>Assigned</th>
                      <th>Claim status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assigned.length ? (
                      assigned.map((voucher) => (
                        <tr key={voucher.id}>
                          <td>
                            {people.get(voucher.participantId!)
                              ?.normalizedEmail || "Participant access revoked"}
                          </td>
                          <td>
                            {eventDate(
                              voucher.assignedAt,
                              event.timezone,
                              true,
                            )}
                          </td>
                          <td>
                            <span
                              className={`${styles.badge} ${voucher.claimedAt ? styles.active : styles.draft}`}
                            >
                              {voucher.claimedAt ? "Claimed" : "Assigned"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className={styles.tableEmpty}>
                          No vouchers have been assigned yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>
            <details className={styles.creditBody}>
              <summary
                style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                Edit offer details
              </summary>
              <div style={{ marginTop: 22 }}>
                <OfferForm
                  hackathonId={event.id}
                  timezone={event.timezone}
                  offer={offer}
                />
              </div>
            </details>
          </section>
        );
      })}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h2>
              {offers.length
                ? "Add another credit offer"
                : "Create your first credit offer"}
            </h2>
            <p>
              Each offer has its own inventory and one-voucher-per-person
              allocation.
            </p>
          </div>
        </div>
        <div className={styles.sectionBody}>
          <OfferForm hackathonId={event.id} timezone={event.timezone} />
        </div>
      </section>
    </>
  );
}
