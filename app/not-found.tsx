import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell page-section">
      <div className="empty-state">
        <h1>Page not found</h1>
        <p>
          The event or project may be private, or the link may have changed.
        </p>
        <Link href="/hackathons" className="button button-primary">
          Explore hackathons
        </Link>
      </div>
    </div>
  );
}
