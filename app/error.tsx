"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="shell page-section">
      <div className="empty-state">
        <h1>We couldn’t load this page.</h1>
        <p>
          Please try again. If this continues, the service configuration may
          need attention.
        </p>
        <button type="button" className="button button-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
