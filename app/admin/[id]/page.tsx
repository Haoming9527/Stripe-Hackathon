import Link from "next/link";
import { AdminLiveUpdates } from "@/components/admin/AdminLiveUpdates";
import { Suspense } from "react";
import AdminLoading from "../loading";
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
import { adminHeaderFields, overviewFields } from "@/components/admin/event/types";

export const dynamic = "force-dynamic";

const tabs = [
  "overview",
  "settings",
  "participants",
  "teams",
  "projects",
  "credits",
] as const;

type AdminTab = typeof tabs[number];

async function readTabEvent(id: string, tab: AdminTab) {
  const where = { id };
  if (tab === "overview") {
    const event = await prisma.hackathon.findUnique({ where, select: overviewFields });
    return { tab, event };
  }
  if (tab === "settings") {
    const event = await prisma.hackathon.findUnique({
      where, include: { tracks: { orderBy: { position: "asc" } } },
    });
    return { tab, event };
  }
  if (tab === "participants") {
    const event = await prisma.hackathon.findUnique({
      where, select: { ...adminHeaderFields, _count: { select: { participants: true } } },
    });
    return { tab, event };
  }
  const event = await prisma.hackathon.findUnique({
    where, select: { ...adminHeaderFields, minTeamSize: true, maxTeamSize: true },
  });
  return { tab, event };
}

export default async function AdminEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; page?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const tab = tabs.find((value) => value === query.tab) || "overview";
  return (
    <Suspense key={`${id}/${tab}`} fallback={<AdminLoading />}>
      <AdminEventContent id={id} tab={tab} page={typeof query.page === "string" ? query.page : undefined} />
    </Suspense>
  );
}

async function AdminEventContent({ id, tab, page }: { id: string; tab: AdminTab; page?: string }) {
  await requireAdmin();
  const data = await readTabEvent(id, tab);
  if (!data.event) notFound();
  const { event } = data;
  return (
    <>
      <AdminLiveUpdates />
      <Link href="/admin" className={styles.backLink}>
        ← All hackathons
      </Link>
      <div className={styles.topline}>
        <div>
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
      {data.tab === "overview" && <Overview event={data.event} />}
      {data.tab === "settings" && <Settings event={data.event} />}
      {data.tab === "participants" && <Participants event={data.event} requestedPage={page} />}
      {data.tab === "teams" && <Teams event={data.event} />}
      {data.tab === "projects" && <Projects event={data.event} />}
      {data.tab === "credits" && <Credits event={data.event} />}
    </>
  );
}
