import "server-only";
import { ArrowUpRight, Clock3, Gift } from "lucide-react";
import { eventDate, safeExternalUrl } from "@/lib/presentation";
import { decryptVoucher } from "@/lib/credits";
import { ActionForm } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import type { PortalData } from "./data";

export function CreditsTab({
  event,
  offers,
  now,
}: Pick<PortalData, "event" | "offers" | "now">) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Sponsor credits</h2>
          <p className="muted">
            Claim your assigned offers and redeem them with each sponsor.
          </p>
        </div>
      </div>
      {offers.length ? (
        <div className="credit-grid">
          {offers.map((offer) => {
            const voucher = offer.vouchers[0];
            const expired = !!offer.expiresAt && offer.expiresAt <= now;
            let value = "";
            let decryptError = false;
            if (voucher?.claimedAt) {
              try {
                value = decryptVoucher(voucher.encryptedValue);
              } catch {
                decryptError = true;
              }
            }
            const redemptionUrl =
              safeExternalUrl(value) || safeExternalUrl(offer.redemptionUrl);
            return (
              <article className="credit-card" key={offer.id}>
                <div className="credit-card-top">
                  <span className="credit-icon">
                    <Gift size={22} />
                  </span>
                  <span
                    className={`badge ${expired ? "badge-ended" : voucher ? "badge-active" : "badge-draft"}`}
                  >
                    {expired
                      ? "Expired"
                      : voucher?.claimedAt
                        ? "Claimed"
                        : voucher
                          ? "Assigned to you"
                          : "Not assigned yet"}
                  </span>
                </div>
                <h3>{offer.name}</h3>
                {offer.sponsor && <p className="credit-sponsor">{offer.sponsor}</p>}
                {offer.valueLabel && (
                  <p className="credit-value">{offer.valueLabel}</p>
                )}
                <p className="credit-description">{offer.description}</p>
                {offer.expiresAt && (
                  <p className="credit-expiry">
                    <Clock3 size={14} /> Claim by{" "}
                    {eventDate(offer.expiresAt, event.timezone, true)}
                  </p>
                )}
                {offer.instructions && (
                  <p className="field-hint preserve-lines">
                    {offer.instructions}
                  </p>
                )}
                <div className="credit-card-bottom">
                  {value ? (
                    <>
                      <div className="credit-code">
                        <code>{value}</code>
                        <CopyButton value={value} />
                      </div>
                      {redemptionUrl && (
                        <a
                          href={redemptionUrl}
                          className="button button-primary"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open redemption page <ArrowUpRight size={16} />
                        </a>
                      )}
                      <p className="field-hint">
                        Claimed here. Complete redemption with the provider.
                      </p>
                    </>
                  ) : decryptError ? (
                    <div className="notice notice-error">
                      This code couldn’t be opened. Please contact the
                      organizer.
                    </div>
                  ) : voucher && !expired ? (
                    <ActionForm intent="credits.claim">
                      <input
                        type="hidden"
                        name="voucherId"
                        value={voucher.id}
                      />
                      <button type="submit" className="button button-primary">
                        <Gift size={16} /> Claim your credit
                      </button>
                    </ActionForm>
                  ) : (
                    <p className="muted">
                      {expired
                        ? "The claim period for this offer has ended."
                        : "Your organizer will assign a code when it’s available."}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            <Gift size={28} />
          </span>
          <h3>No sponsor offers yet</h3>
          <p>Offers will appear here when your organizer adds them.</p>
        </div>
      )}
    </>
  );
}
