import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { SiteFrame } from "@/components/SiteFrame";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "optional",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Stripe Singapore Community · Hackathons",
    template: "%s · Stripe Singapore Community",
  },
  description:
    "Hackathons for the Stripe community in Singapore. Meet local builders, form a team, and share what you build.",
  icons: { icon: "/brand-icon.svg" },
  verification: { google: "5aS9IjoK_08BQw_r5onqVHiprvE7xv1g764TEhPjnlM" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteFrame header={<SiteHeader />} footer={<SiteFooter />}>
          {children}
        </SiteFrame>
        {process.env.VERCEL === "1" && <Analytics />}
      </body>
    </html>
  );
}
