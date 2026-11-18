import Link from "next/link";
import { prisma } from "@/lib/db";
import styles from "@/components/admin/styles";
import { requireAdmin } from "@/components/admin/access";
import { Status } from "@/components/admin/event/Status";

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
        <h1>Hackathons</h1>
        <Link className="button button-primary" href="/admin/new">
          Create hackathon
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
      {events.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label="Your hackathons">
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Start date</th>
                <th scope="col">Status</th>
                <th scope="col">Participants</th>
                <th scope="col">Projects</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <Link href={`/admin/${event.id}`} className={styles.textLink}>
                      {event.title}
                    </Link>
                    {(event.tagline || event.location) && (
                      <small>{event.tagline || event.location}</small>
                    )}
                  </td>
                  <td>
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: event.timezone,
                    }).format(event.startsAt)}
                  </td>
                  <td>
                    <Status status={event.status} />
                  </td>
                  <td>{event._count.participants}</td>
                  <td>{event._count.projects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.empty}>
          <h2>No hackathons yet</h2>
          <p>Created events will appear here.</p>
        </div>
      )}
    </>
  );
}
