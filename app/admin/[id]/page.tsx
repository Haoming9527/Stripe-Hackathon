import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/components/admin/access";
import { eventDate } from "@/components/admin/format";
import styles from "@/components/admin/styles";
import { Status } from "@/components/admin/event/Status";
import { Overview } from "@/components/admin/event/Overview";
import { Participants } from "@/components/admin/event/Participants";
import { Teams } from "@/components/admin/event/Teams";
import { Projects } from "@/components/admin/event/Projects";
import { Credits } from "@/components/admin/event/Credits";
import { Settings } from "@/components/admin/event/Settings";

export const dynamic = "force-dynamic";

const tabs = [
  "overview",
  "settings",
  "participants",
  "teams",
  "projects",
  "credits",
] as const;

export default async function AdminEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const event = await prisma.hackathon.findUnique({
    where: { id },
    include: {
      tracks: { orderBy: { position: "asc" } },
      _count: {
        select: {
          participants: true,
          teams: true,
          projects: true,
          votes: true,
        },
      },
    },
  });
  if (!event) notFound();
  const tab = tabs.find((value) => value === query.tab) || "overview";
  return (
    <>
      <Link href="/admin" className={styles.backLink}>
        ← All hackathons
      </Link>
      <div className={styles.topline}>
        <div>
          <span className={styles.kicker}>Your community, in motion</span>
          <h1>{event.title}</h1>
          <p>
            {event.location || "Community hackathon"} ·{" "}
            {eventDate(event.startsAt, event.timezone)}
          </p>
        </div>
        <div className={styles.titleActions}>
          <Status status={event.status} />
          <Link
            className="button button-secondary"
            href={`/hackathons/${event.slug}/portal`}
          >
            Participant view ↗
          </Link>
          {event.status !== "DRAFT" && (
            <Link
              className="button button-secondary"
              href={`/hackathons/${event.slug}`}
            >
              View gallery ↗
            </Link>
          )}
        </div>
      </div>
      <nav className={styles.eventTabs} aria-label="Manage event">
        {tabs.map((value) => (
          <Link
            key={value}
            href={`/admin/${event.id}?tab=${value}`}
            className={`${styles.eventTab} ${tab === value ? styles.eventTabActive : ""}`}
            aria-current={tab === value ? "page" : undefined}
          >
            {value === "projects"
              ? "Projects & votes"
              : value.charAt(0).toUpperCase() + value.slice(1)}
          </Link>
        ))}
      </nav>
      {tab === "overview" && <Overview event={event} />}
      {tab === "settings" && <Settings event={event} />}
      {tab === "participants" && <Participants event={event} />}
      {tab === "teams" && <Teams event={event} />}
      {tab === "projects" && <Projects event={event} />}
      {tab === "credits" && <Credits event={event} />}
    </>
  );
}
