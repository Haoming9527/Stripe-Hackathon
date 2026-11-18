import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Heart,
  MapPin,
  Search,
  Shapes,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/auth";
import {
  findPublicEvent,
  findParticipant,
  publicProjectSelect,
} from "@/lib/queries";
import { eventDate } from "@/lib/presentation";
import { ProjectCard } from "@/components/ProjectCard";
import { ActionForm } from "@/components/ActionForm";

export const dynamic = "force-dynamic";

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; track?: string; page?: string }>;
}) {
  const { slug } = await params;
  const filter = await searchParams;
  const [event, viewer] = await Promise.all([
    findPublicEvent(slug),
    getViewer(),
  ]);
  if (!event) notFound();
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(filter.page || "1", 10) || 1),
  );
  const query = typeof filter.q === "string" ? filter.q.slice(0, 200) : "";
  const track = typeof filter.track === "string" ? filter.track : "";
  const where = {
    hackathonId: event.id,
    status: "SUBMITTED" as const,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
            {
              team: { name: { contains: query, mode: "insensitive" as const } },
            },
          ],
        }
      : {}),
    ...(track ? { tracks: { some: { trackId: track } } } : {}),
  };
  const [projects, total, participant, votes, owned] = await Promise.all([
    prisma.project.findMany({
      where,
      select: publicProjectSelect,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * 24,
      take: 24,
    }),
    prisma.project.count({ where }),
    viewer ? findParticipant(event.id, viewer.id, viewer.email) : null,
    viewer
      ? prisma.vote.findMany({
          where: { hackathonId: event.id, userId: viewer.id },
          select: { projectId: true, project: { select: { status: true } } },
        })
      : [],
    viewer
      ? prisma.project.findMany({
          where: {
            hackathonId: event.id,
            OR: [
              { contributorIds: { has: viewer.id } },
              {
                team: {
                  members: {
                    some: {
                      OR: [
                        { userId: viewer.id },
                        { userId: null, normalizedEmail: viewer.email },
                      ],
                    },
                  },
                },
              },
            ],
          },
          select: { id: true },
        })
      : [],
  ]);
  const now = new Date();
  const votingOpen =
    event.status === "ACTIVE" &&
    !event.votingClosed &&
    now >= event.votingOpensAt &&
    now < event.votingClosesAt;
  const votedIds = new Set(votes.map((v) => v.projectId));
  const ownIds = new Set(owned.map((p) => p.id));
  const remaining = Math.max(0, event.votesPerUser - votes.length);
  const unavailableVotes = votes.filter(
    (vote) => vote.project.status !== "SUBMITTED",
  );
  function pageUrl(n: number) {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (track) p.set("track", track);
    p.set("page", String(n));
    return `/hackathons/${slug}?${p}`;
  }
  return (
    <>
      <section className="event-hero">
        <div className="shell">
          <Link href="/hackathons" className="back-link">
            <ArrowLeft size={15} /> All hackathons
          </Link>
          <div className="event-hero-grid">
            <div>
              <span
                className={`badge ${event.status === "ACTIVE" ? "badge-active" : "badge-ended"}`}
              >
                {event.status === "ACTIVE" ? "Active hackathon" : "Ended"}
              </span>
              <h1>{event.title}</h1>
              <p className="lead">
                {event.tagline ||
                  "Explore what the community has been building."}
              </p>
              <div className="event-meta">
                <span>
                  <CalendarDays size={16} />
                  {eventDate(event.startsAt, event.timezone)}
                </span>
                <span>
                  <MapPin size={16} />
                  {event.location || "Online"}
                </span>
              </div>
            </div>
            <div className="event-hero-action">
              {participant || viewer?.isAdmin ? (
                <Link
                  href={`/hackathons/${slug}/portal`}
                  className="button button-primary"
                >
                  Your participant portal <ArrowRight size={16} />
                </Link>
              ) : !viewer ? (
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(`/hackathons/${slug}/portal`)}`}
                  className="button button-primary"
                >
                  Participant sign in <ArrowRight size={16} />
                </Link>
              ) : (
                <div className="notice">
                  Participating? Sign in with the email on your invitation.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <section className="shell gallery-section">
        <div className="gallery-heading">
          <div>
            <p className="eyebrow">Built by the community</p>
            <h2>
              The project gallery
              <span className="count-pill">{event._count.projects}</span>
            </h2>
          </div>
          <div className="voting-summary">
            <Heart size={17} />
            <div>
              <strong>
                {votingOpen
                  ? viewer
                    ? `${remaining} of ${event.votesPerUser} votes remaining`
                    : `${event.votesPerUser} votes for every builder and visitor`
                  : "Voting is closed"}
              </strong>
              <span>
                {votingOpen
                  ? `Until ${eventDate(event.votingClosesAt, event.timezone, true)}`
                  : event.status === "ENDED" || now >= event.votingClosesAt
                    ? "The projects live on. Keep exploring."
                    : `Opens ${eventDate(event.votingOpensAt, event.timezone, true)}`}
              </span>
            </div>
          </div>
        </div>
        {votingOpen && unavailableVotes.length > 0 && (
          <div className="notice">
            <strong>
              Some projects you voted for are no longer available.
            </strong>
            <p>You can withdraw those votes and use them on another project.</p>
            <div className="inline">
              {unavailableVotes.map((vote, index) => (
                <ActionForm intent="vote.withdraw" key={vote.projectId}>
                  <input
                    type="hidden"
                    name="projectId"
                    value={vote.projectId}
                  />
                  <button type="submit" className="text-button">
                    Withdraw vote for unavailable project {index + 1}
                  </button>
                </ActionForm>
              ))}
            </div>
          </div>
        )}
        <form className="gallery-filters" method="get">
          <label className="search-input">
            <Search size={18} />
            <span className="sr-only">Search projects</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="Search projects, ideas, or teams"
            />
          </label>
          {event.tracks.length > 0 && (
            <label>
              <span className="sr-only">Filter by track</span>
              <select name="track" defaultValue={track}>
                <option value="">All tracks</option>
                {event.tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="button button-secondary" type="submit">
            Search
          </button>
          {(query || track) && (
            <Link className="text-button" href={`/hackathons/${slug}`}>
              Clear
            </Link>
          )}
        </form>
        {projects.length ? (
          <div className="project-grid">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                slug={slug}
                vote={{
                  signedIn: !!viewer,
                  own: ownIds.has(project.id),
                  voted: votedIds.has(project.id),
                  open: votingOpen,
                  remaining,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Shapes size={28} />
            </span>
            <h3>
              {query || track
                ? "No projects match your search."
                : "Great things are in the making."}
            </h3>
            <p>
              {query || track
                ? "Try another keyword or explore all tracks."
                : "Projects appear here as soon as teams submit. Come back to see what they build."}
            </p>
            {(query || track) && (
              <Link
                href={`/hackathons/${slug}`}
                className="button button-secondary"
              >
                View all projects
              </Link>
            )}
          </div>
        )}
        {(page > 1 || total > page * 24) && (
          <nav className="pagination" aria-label="Project pages">
            {page > 1 && (
              <Link
                href={pageUrl(page - 1)}
                className="button button-secondary"
              >
                Previous
              </Link>
            )}
            <span>Page {page}</span>
            {total > page * 24 && (
              <Link
                href={pageUrl(page + 1)}
                className="button button-secondary"
              >
                Next
              </Link>
            )}
          </nav>
        )}
      </section>
    </>
  );
}
