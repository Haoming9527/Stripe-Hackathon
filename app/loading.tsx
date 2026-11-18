export default function Loading() {
  return (
    <div className="shell page-section" role="status" aria-label="Loading">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-subtitle" />
      <div className="skeleton-list">
        {[1, 2, 3].map((n) => (
          <div key={n} className="skeleton skeleton-row" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
