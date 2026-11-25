import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import Layout from "../app/layout";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist" }),
  Geist_Mono: () => ({ variable: "geist-mono" }),
}));
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
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
