import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell page-section">
      <div className="empty-state">
        <span className="eyebrow">404</span>
        <h1>This page is off the map.</h1>
        <p>
          The event or project may be private, or the link may have changed.
        </p>
        <Link href="/" className="button button-primary">
          Explore hackathons
        </Link>
      </div>
    </div>
  );
}
