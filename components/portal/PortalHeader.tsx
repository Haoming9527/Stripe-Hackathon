import "server-only";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Code2, Gift, Users } from "lucide-react";
import type { PortalData } from "./data";
import { NavigationIcon } from "@/components/NavigationIcon";

export function PortalHeader({
  event,
  viewer,
  tab,
  hasInvitations,
  adminPreview,
  hasCreditOffers,
}: Pick<PortalData, "event" | "viewer" | "tab" | "hasCreditOffers"> & {
  hasInvitations: boolean;
  adminPreview: boolean;
}) {
  const slug = event.slug;
  const base = `/hackathons/${slug}/portal`;
  const backToAdmin = adminPreview || (viewer.isAdmin && event.status === "DRAFT");
  const tabs = [
    { id: "overview", label: "Overview", icon: CalendarDays },
    { id: "team", label: "Your team", icon: Users },
    { id: "submission", label: "Your project", icon: Code2 },
  ];
  if (hasCreditOffers) tabs.push({ id: "credits", label: "Credits", icon: Gift });
  return (
    <section className="portal-header">
      <div className="shell">
        <Link
          href={backToAdmin ? `/admin/${event.id}` : `/hackathons/${slug}`}
          className="back-link"
        >
          <NavigationIcon><ArrowLeft size={15} /></NavigationIcon>
          {backToAdmin ? "Back to admin" : "Event gallery"}
        </Link>
        <div className="page-heading">
          <div>
            <h1>{event.title}</h1>
            <p className="muted">Participant portal · {viewer.email}</p>
          </div>
          <span
            className={`badge ${event.status === "ACTIVE" ? "badge-active" : "badge-ended"}`}
          >
            {event.status === "ACTIVE"
              ? "Hackathon active"
              : event.status === "DRAFT"
                ? "Draft preview"
                : "Hackathon ended"}
          </span>
        </div>
        <nav className="tabs" aria-label="Participant portal">
          {tabs.map((item) => (
            <Link
              href={`${base}?tab=${item.id}`}
              key={item.id}
              className={`tab ${tab === item.id ? "tab-active" : ""}`}
              aria-current={tab === item.id ? "page" : undefined}
            >
              <NavigationIcon><item.icon size={16} /></NavigationIcon>
              {item.label}
              {item.id === "team" && hasInvitations && (
                <span className="notification-dot" role="img" aria-label="Pending invitations" />
              )}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
