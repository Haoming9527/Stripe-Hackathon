import Link from "next/link";
import EventForm from "@/components/admin/EventForm";
import styles from "@/components/admin/styles";
import { requireAdmin } from "@/components/admin/access";

export default async function NewHackathonPage() {
  await requireAdmin();
  return (
    <>
      <Link href="/admin" className={styles.backLink}>
        ← All hackathons
      </Link>
      <div className={styles.topline}>
        <div>
          <span className={styles.kicker}>A new beginning</span>
          <h1>Create a hackathon</h1>
          <p>Bring Singapore’s Stripe community together to build.</p>
        </div>
      </div>
      <EventForm />
    </>
  );
}
