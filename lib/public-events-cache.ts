import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { findFeaturedEvent, listPublicEvents } from "@/lib/queries";

export const FEATURED_EVENT_TAG = "public-featured-event";
export const PUBLIC_DIRECTORY_TAG = "public-event-directory";

// A local production build can also run against an isolated test schema.
const databaseKey = createHash("sha256").update(process.env.DATABASE_URL_POOLED ?? "").digest("hex");

export const getFeaturedEvent = unstable_cache(
  async () => {
    const event = await findFeaturedEvent();
    return event && { ...event, startsAt: event.startsAt.toISOString() };
  },
  [FEATURED_EVENT_TAG, databaseKey],
  { tags: [FEATURED_EVENT_TAG], revalidate: 300 },
);

export const getPublicDirectory = unstable_cache(
  async () => (await listPublicEvents()).map((event) => ({
    ...event, startsAt: event.startsAt.toISOString(),
  })),
  [PUBLIC_DIRECTORY_TAG, databaseKey],
  { tags: [PUBLIC_DIRECTORY_TAG], revalidate: 300 },
);
