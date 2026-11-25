import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import Layout from "../app/layout";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist" }),
  Geist_Mono: () => ({ variable: "geist-mono" }),
}));
vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => <script defer src="/_vercel/insights/script.js" />,
}));
vi.mock("@/components/SiteHeader", () => ({
  SiteHeader: () => <header>Site navigation</header>,
  SiteFooter: () => <footer>Site policies</footer>,
}));
vi.mock("@/components/SiteFrame", () => ({
  SiteFrame: ({
    header,
    footer,
    children,
  }: React.PropsWithChildren<{ header: React.ReactNode; footer: React.ReactNode }>) => (
    <>
      {header}
      <main id="main">{children}</main>
      {footer}
    </>
  ),
}));

afterEach(() => vi.unstubAllEnvs());

it.each([["1", true], [undefined, false]] as const)("loads the analytics endpoint when hosted on Vercel (%s)", (vercel, enabled) => {
  vi.stubEnv("VERCEL", vercel);
  const html = renderToStaticMarkup(<Layout>Home</Layout>);
  expect(html.includes("/_vercel/insights/script.js")).toBe(enabled);
});

it("provides the skip link and places page content between the site landmarks", () => {
  const html = renderToStaticMarkup(
    <Layout>
      <h1>Welcome</h1>
    </Layout>,
  );
  expect(html).toContain('lang="en"');
  expect(html).toContain('href="#main"');
  expect(html).toContain("<header>Site navigation</header><main");
  expect(html).toContain("<h1>Welcome</h1></main><footer>");
});
