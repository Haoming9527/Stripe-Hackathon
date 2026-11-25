import { describe, expect, it } from "vitest";
import { contentRows, eventDate, youtubeId, safeExternalUrl } from "../lib/presentation";

describe("safe project previews", () => {
  it("extracts IDs from watch, short, embed, shorts and live URLs", () => {
    for (const url of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=3", "https://www.youtube.com/embed/dQw4w9WgXcQ", "https://m.youtube.com/shorts/dQw4w9WgXcQ", "https://youtube.com/live/dQw4w9WgXcQ"]) expect(youtubeId(url)).toBe("dQw4w9WgXcQ");
  });
  it("rejects impostor domains, malformed IDs and unsafe schemes", () => {
    for (const url of ["https://youtube.com.attacker.test/watch?v=dQw4w9WgXcQ", "https://youtu.be/abc", "javascript:alert(1)", "https://vimeo.com/123", "not a URL"]) expect(youtubeId(url)).toBeNull();
    expect(safeExternalUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeExternalUrl("https://example.com/demo")).toBe("https://example.com/demo");
    expect(safeExternalUrl("broken link")).toBeUndefined();
  });
});

describe("event details", () => {
  it("uses the event timezone when the local date differs from UTC", () => {
    const instant = "2027-03-04T17:10:00Z";
    expect(eventDate(instant)).toBe("Mar 5, 2027");
    expect(eventDate(instant, "UTC", true)).toContain("Mar 4, 2027");
  });

  it("reads structured schedule and resource rows from saved event content", () => {
    const session = { label: "Demos", time: "15:00" };
    expect(contentRows([session, null, ["malformed"], "old note"])).toEqual([session]);
    expect(contentRows(null)).toEqual([]);
  });
});
