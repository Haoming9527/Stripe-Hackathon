export default function Loading() {
  return (
    <div className="shell page-section" role="status" aria-label="Loading">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-subtitle" />
      <div className="project-grid">
        {[1, 2, 3].map((n) => (
          <div key={n} className="skeleton skeleton-card" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
