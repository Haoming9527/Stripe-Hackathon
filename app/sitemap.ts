import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin =
    process.env.NEXTAUTH_URL || "https://stripe-hackathon-singapore.vercel.app";
  const events = await prisma.hackathon.findMany({
    where: { status: { not: "DRAFT" } },
    select: {
      slug: true,
      updatedAt: true,
      projects: {
        where: { status: "SUBMITTED" },
        select: { id: true, updatedAt: true },
      },
    },
  });

  return [
    ...["/", "/hackathons", "/privacy", "/terms"].map((path) => ({
      url: new URL(path, origin).href,
    })),
    ...events.flatMap((event) => {
      const path = `/hackathons/${encodeURIComponent(event.slug)}`;
      return [
        { url: new URL(path, origin).href, lastModified: event.updatedAt },
        ...event.projects.map((project) => ({
          url: new URL(
            `${path}/projects/${encodeURIComponent(project.id)}`,
            origin,
          ).href,
          lastModified: project.updatedAt,
        })),
      ];
    }),
  ];
}
