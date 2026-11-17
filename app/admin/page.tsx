import Link from "next/link";
import { prisma } from "@/lib/db";
import styles from "@/components/admin/styles";
import { requireAdmin } from "@/components/admin/access";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireAdmin();
  const events = await prisma.hackathon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { participants: true, projects: true } } },
  });
  const totals = events.reduce(
    (acc, event) => ({
      participants: acc.participants + event._count.participants,
      projects: acc.projects + event._count.projects,
    }),
    { participants: 0, projects: 0 },
  );
  return (
    <>
      <div className={styles.topline}>
        <div>
          <span className={styles.kicker}>Organizer workspace</span>
          <h1>Hackathons</h1>
        </div>
        <Link className="button button-primary" href="/admin/new">
          ＋ Create hackathon
        </Link>
      </div>
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span>Hackathons</span>
          <strong>{events.length}</strong>
        </div>
        <div className={styles.metric}>
          <span>Active now</span>
          <strong>
            {events.filter((event) => event.status === "ACTIVE").length}
          </strong>
        </div>
        <div className={styles.metric}>
          <span>Participants</span>
          <strong>{totals.participants}</strong>
        </div>
        <div className={styles.metric}>
          <span>Projects</span>
          <strong>{totals.projects}</strong>
        </div>
      </div>
      <div className={styles.topline} style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, margin: 0 }}>Your hackathons</h2>
        </div>
      </div>
      {events.length ? (
        <div className={styles.eventGrid}>
          {events.map((event) => (
            <article key={event.id} className={styles.eventCard}>
              <div
                className={`${styles.eventBand} ${event.status === "ENDED" ? styles.eventBandEnded : ""}`}
              />
              <div className={styles.eventCardBody}>
                <div className={styles.eventMeta}>
                  <span
                    className={`${styles.badge} ${styles[event.status.toLowerCase() as "active" | "draft" | "ended"]}`}
                  >
                    {event.status === "ACTIVE"
                      ? "Active"
                      : event.status === "DRAFT"
                        ? "Draft"
                        : "Ended"}
                  </span>
                  <span>
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: event.timezone,
                    }).format(event.startsAt)}
                  </span>
                </div>
                <h2>
                  <Link href={`/admin/${event.id}`}>{event.title}</Link>
                </h2>
                <p>
                  {event.tagline ||
                    event.location ||
                    "A new gathering for the community."}
                </p>
                <div className={styles.eventCardBottom}>
                  <div className={styles.eventNumbers}>
                    <span>
                      <strong>{event._count.participants}</strong> participants
                    </span>
                    <span>
                      <strong>{event._count.projects}</strong> projects
                    </span>
                  </div>
                  <Link href={`/admin/${event.id}`} className={styles.textLink}>
                    Manage →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <h2>No hackathons yet</h2>
          <p>Create a hackathon to get started.</p>
          <Link href="/admin/new" className="button button-primary">
            Create hackathon
          </Link>
        </div>
      )}
    </>
  );
}
