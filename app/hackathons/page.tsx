import Link from "next/link";
import { listPublicEvents } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Public galleries" };

export default async function HackathonsPage() {
  const events = await listPublicEvents();
  return (
    <section className="shell gallery-directory">
      <h1>Public galleries</h1>
      <p className="muted">
        Explore projects built by the Stripe community in Singapore.
      </p>
      {events.length ? (
        <ul className="gallery-directory-list">
          {events.map((event) => (
            <li key={event.id}>
              <Link href={`/hackathons/${event.slug}`}>
                <span>{event.title}</span>
                <span className="muted">
                  {event.status === "ACTIVE" ? "Active" : "Ended"}{" "}
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="notice">New hackathons will appear here soon.</p>
      )}
    </section>
  );
}
