import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { findFeaturedEvent } from "@/lib/queries";

export const FEATURED_EVENT_TAG = "public-featured-event";

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
