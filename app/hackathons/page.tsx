import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NavigationIcon } from "@/components/NavigationIcon";
import { eventDate } from "@/lib/presentation";
import { listPublicEvents } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Public galleries" };

export default async function HackathonsPage() {
  const events = await listPublicEvents();
  return (
    <section className="shell event-directory">
      <header className="directory-heading">
        <h1>Public galleries</h1>
        <p>Explore projects from Stripe Singapore Community hackathons.</p>
      </header>
      {events.length ? (
        <ul className="gallery-card-grid directory-list">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                className="gallery-card directory-card"
                href={`/hackathons/${event.slug}`}
                aria-labelledby={`heading-${event.slug}`}
              >
                <div className="directory-card-meta">
                  <span
                    className={`gallery-status ${event.status === "ACTIVE" ? "is-active" : ""}`}
                  >
                    {event.status === "ACTIVE" ? "Active" : "Ended"}
                  </span>
                  <time dateTime={event.startsAt.toISOString()}>
                    <span className="sr-only">Starts </span>
                    {eventDate(event.startsAt, event.timezone)}
                  </time>
                </div>
                <div className="directory-card-heading">
                  <h2 id={`heading-${event.slug}`}>{event.title}</h2>
                  {event.tagline && <p>{event.tagline}</p>}
                </div>
                <div className="directory-card-footer">
                  <div>
                    {event.location && <span>{event.location}</span>}
                    <span>
                      {event._count.projects}{" "}
                      {event._count.projects === 1 ? "project" : "projects"}
                    </span>
                  </div>
                  <NavigationIcon>
                    <ArrowRight className="directory-arrow" size={18} />
                  </NavigationIcon>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="directory-empty">
          No hackathons have been published yet.
        </p>
      )}
    </section>
  );
}
