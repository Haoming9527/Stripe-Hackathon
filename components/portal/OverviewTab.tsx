import "server-only";
import { EventDescription } from "@/components/EventDescription";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Code2,
  MapPin,
  Trophy,
} from "lucide-react";
import { contentRows, eventDate, safeExternalUrl } from "@/lib/presentation";
import type { PortalData } from "./data";
import { NavigationIcon } from "@/components/NavigationIcon";

export function OverviewTab({
  event,
  team,
  submissionsOpen,
  now,
}: Pick<PortalData, "event" | "team" | "submissionsOpen" | "now">) {
  const base = `/hackathons/${event.slug}/portal`;
  return (
    <>
      <div className="portal-intro">
        <div>
          <h2>Event overview</h2>
          {event.description && (
            <EventDescription>{event.description}</EventDescription>
          )}
          <div className="event-meta">
            <span>
              <CalendarDays size={16} />
              {eventDate(event.startsAt, event.timezone, true)}
            </span>
            <span>
              <MapPin size={16} />
              {event.location || "Online"}
            </span>
          </div>
        </div>
        <div className="deadline-panel">
          <Clock3 size={23} />
          <h3>
            {submissionsOpen
              ? "Submissions open"
              : now < event.submissionOpensAt && event.status === "ACTIVE" && !event.submissionsClosed
                ? "Upcoming submissions"
                : "Submissions closed"}
          </h3>
          <p>
            {now < event.submissionOpensAt && event.status === "ACTIVE" && !event.submissionsClosed
              ? `Opens ${eventDate(event.submissionOpensAt, event.timezone, true)}`
              : `Deadline · ${eventDate(event.submissionClosesAt, event.timezone, true)}`}
          </p>
          <Link
            href={`${base}?tab=${team ? "submission" : "team"}`}
            className="button button-primary"
          >
            {team ? "Open your project" : "Open team page"}
            <NavigationIcon><ArrowRight size={16} /></NavigationIcon>
          </Link>
        </div>
      </div>
      {event.meetingUrl && (
        <a
          className="meeting-banner"
          href={safeExternalUrl(event.meetingUrl)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>Event meeting</strong>
          <span className="button button-secondary">
            Join meeting <ArrowUpRight size={16} />
          </span>
        </a>
      )}
      <div className="portal-columns">
        <div>
          <h3 className="subsection-title">
            <CalendarDays size={18} /> Schedule
          </h3>
          {contentRows(event.schedule).length ? (
            <div className="schedule-list">
              {contentRows(event.schedule).map((item, i) => (
                <div key={i}>
                  <time>{item.time}</time>
                  <span>
                    <strong>{item.label || item.title || item.name}</strong>
                    {item.description && <small>{item.description}</small>}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">The organizer will share the schedule here.</p>
          )}
          {event.attendeeInfo && (
            <div className="attendee-info">
              <h3>Attendee information</h3>
              <p className="preserve-lines">{event.attendeeInfo}</p>
            </div>
          )}
        </div>
        <div>
          <h3 className="subsection-title">
            <Code2 size={18} /> Resources
          </h3>
          {contentRows(event.resources).length ? (
            <div className="resource-list">
              {contentRows(event.resources).map((item, i) => (
                <a
                  key={i}
                  href={safeExternalUrl(item.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>
                    {item.title || item.name || item.label}
                    {item.description && <small>{item.description}</small>}
                  </span>
                  <ArrowUpRight size={16} />
                </a>
              ))}
            </div>
          ) : (
            <p className="muted">Resources will appear here when added.</p>
          )}
          <h3 className="subsection-title prizes-heading">
            <Trophy size={18} /> Prizes
          </h3>
          {contentRows(event.prizes).length ? (
            <div className="prize-list">
              {contentRows(event.prizes).map((item, i) => (
                <div key={i}>
                  <strong>{item.title || item.name}</strong>
                  <p>{item.description || item.amount}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              Prize details will be announced by the organizer.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
