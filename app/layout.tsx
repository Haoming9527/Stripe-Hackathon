import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { SiteFrame } from "@/components/SiteFrame";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Stripe Community Singapore · Hackathons",
    template: "%s · Stripe Community Singapore",
  },
  description:
    "Hackathons for the Stripe community in Singapore. Meet local builders, form a team, and share what you build.",
  icons: { icon: "/brand-icon.svg" },
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
      </body>
    </html>
  );
}
