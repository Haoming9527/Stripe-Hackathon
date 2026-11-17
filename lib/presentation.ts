export function eventDate(
  value: Date | string,
  timezone = "Asia/Singapore",
  time = false,
) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: timezone,
    ...(time
      ? ({ hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const)
      : {}),
  }).format(new Date(value));
}

export function youtubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const id =
      host === "youtu.be"
        ? parsed.pathname.split("/")[1]
        : ["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(
              host,
            )
          ? parsed.searchParams.get("v") ||
            (/^\/(embed|shorts|live)\//.test(parsed.pathname)
              ? parsed.pathname.split("/")[2]
              : null)
          : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export type ContentRow = {
  title?: string;
  name?: string;
  time?: string;
  description?: string;
  url?: string;
  label?: string;
  amount?: string;
};

export function contentRows(value: unknown): ContentRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is ContentRow =>
      !!row && typeof row === "object" && !Array.isArray(row),
  );
}

export function safeExternalUrl(
  url: string | undefined | null,
): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}
