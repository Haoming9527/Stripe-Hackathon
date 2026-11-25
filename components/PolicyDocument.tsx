import type { ReactNode } from "react";
import "@/app/styles/policy.css";

export type PolicySection = {
  id: string;
  title: string;
  content: ReactNode;
};

export function PolicyDocument({
  title,
  introduction,
  sections,
}: {
  title: string;
  introduction: string;
  sections: PolicySection[];
}) {
  return (
    <article aria-labelledby="policy-title">
      <header className="policy-header">
        <div className="shell policy-shell">
          <h1 id="policy-title">{title}</h1>
          <p className="policy-intro">{introduction}</p>
          <p className="policy-date">
            Last updated <time dateTime="2026-11-23">23 November 2026</time>
          </p>
        </div>
      </header>
      <div className="shell policy-shell policy-layout">
        <nav className="policy-nav" aria-label="On this page">
          <p>On this page</p>
          <ul>
            {sections.map(({ id, title }) => (
              <li key={id}>
                <a href={`#${id}`}>{title}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="policy-copy">
          {sections.map(({ id, title, content }) => (
            <section key={id} aria-labelledby={id}>
              <h2 id={id}>{title}</h2>
              {content}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
