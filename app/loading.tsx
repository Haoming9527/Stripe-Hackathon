export default function Loading() {
  return (
    <div className="shell page-section" role="status" aria-label="Loading">
      <span className="sr-only">Loading page…</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-subtitle" />
      <div className="skeleton-list">
        {[1, 2, 3].map((n) => (
          <div key={n} className="skeleton skeleton-row" />
        ))}
      </div>
    </div>
  );
}
