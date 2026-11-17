import type { CreditOffer } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { localDateValue } from "./format";
import styles from "./styles";

export default function OfferForm({
  hackathonId,
  timezone,
  offer,
}: {
  hackathonId: string;
  timezone: string;
  offer?: CreditOffer;
}) {
  return (
    <ActionForm intent="credits.offer.save">
      <input type="hidden" name="hackathonId" value={hackathonId} />
      {offer && <input type="hidden" name="id" value={offer.id} />}
      <div className={styles.fields}>
        <div className={styles.columns}>
          <label className={styles.field}>
            Offer name
            <input
              name="name"
              defaultValue={offer?.name}
              placeholder="API credits"
              required
              maxLength={150}
            />
          </label>
          <label className={styles.field}>
            Sponsor
            <input
              name="sponsor"
              defaultValue={offer?.sponsor}
              placeholder="Sponsor name"
              maxLength={100}
            />
          </label>
        </div>
        <div className={styles.columns}>
          <label className={styles.field}>
            Value or benefit
            <input
              name="valueLabel"
              defaultValue={offer?.valueLabel}
              placeholder="US$100 in API credits"
              maxLength={100}
            />
          </label>
          <label className={styles.field}>
            Claim deadline
            <input
              name="expiresAt"
              type="datetime-local"
              defaultValue={localDateValue(offer?.expiresAt, timezone)}
            />
            <small>{timezone} · leave blank for no expiry</small>
          </label>
        </div>
        <label className={styles.field}>
          Description
          <textarea
            name="description"
            rows={2}
            defaultValue={offer?.description}
            placeholder="Explain what this offer includes."
            maxLength={10000}
          />
        </label>
        <label className={styles.field}>
          Redemption instructions
          <textarea
            name="instructions"
            rows={2}
            defaultValue={offer?.instructions}
            placeholder="Explain how to use the code or redemption link."
            maxLength={10000}
          />
        </label>
        <label className={styles.field}>
          Shared redemption page
          <input
            name="redemptionUrl"
            type="url"
            defaultValue={offer?.redemptionUrl || ""}
            placeholder="https://sponsor.com/redeem"
          />
          <small>
            Optional. Used for code-based vouchers; unique redemption links take
            participants directly to their destination.
          </small>
        </label>
        <div>
          <button className="button button-primary" type="submit">
            {offer ? "Save offer" : "Create credit offer"}
          </button>
        </div>
      </div>
    </ActionForm>
  );
}
