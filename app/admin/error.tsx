"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div className="panel" style={{ padding: "2rem", margin: "2rem" }}>
      <span className="eyebrow">Workspace unavailable</span>
      <h2>We couldn’t load your event data.</h2>
      <p className="muted">
        Check that the database is reachable and the application migrations have
        been applied, then try again. Your changes have not been discarded.
      </p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
