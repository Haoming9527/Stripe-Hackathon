import { describe, expect, it } from "vitest";
import { githubUrl, normalizeEmail, parseLocalDateTime, parseParticipants, parseVoucherValues, safeUrl, windowIsOpen } from "../lib/validation";

describe("participant imports", () => {
  it("normalizes whitespace and case, deduplicates, and preserves meaningful email aliases", () => {
    const result = parseParticipants("email,name\n Person@Example.com ,Person\nperson@example.com,Duplicate\nperson+team@example.com,Alias\np.er.son@example.com,Dots");
    expect(result.participants.map(item => item.normalizedEmail)).toEqual(["person@example.com", "person+team@example.com", "p.er.son@example.com"]);
    expect(result.duplicates).toBe(1);
    expect(result.invalid).toEqual([]);
  });

  it("supports pasted comma, semicolon, and newline-separated email lists", () => {
    const result = parseParticipants("one@example.com,two@example.com\nthree@example.com;four@example.com");
    expect(result.participants).toHaveLength(4);
  });

  it("reports invalid addresses without treating names or formula text as emails", () => {
    const result = parseParticipants('email,name\ninvalid,Name\n"=SUM(A1)",Other\nvalid@example.com,"Doe, Jane"');
    expect(result.invalid).toHaveLength(2);
    expect(result.participants).toEqual([{ normalizedEmail: "valid@example.com", name: "Doe, Jane" }]);
  });

  it("reports missing emails in nonempty CSV records and skips empty records", () => {
    const result = parseParticipants("name,email\nOne,one@example.com\nTwo,\nThree\n,\n\n");
    expect(result.participants).toEqual([{ normalizedEmail: "one@example.com", name: "One" }]);
    expect(result.invalid).toEqual(["Missing email in CSV record 3", "Missing email in CSV record 4"]);
  });

  it("does not canonicalize plus aliases or Gmail dots", () => {
    expect(normalizeEmail(" Foo.Bar+event@Gmail.com ")).toBe("foo.bar+event@gmail.com");
  });
});

describe("URL validation", () => {
  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///etc/passwd", "https://user:password@example.com"])("rejects unsafe external URL %s", value => {
    expect(() => safeUrl(value, "demo URL")).toThrow();
  });

  it("requires an actual GitHub repository, not another host or a profile", () => {
    expect(githubUrl("https://github.com/community/project")).toBe("https://github.com/community/project");
    expect(() => githubUrl("https://github.com.evil.test/community/project")).toThrow();
    expect(() => githubUrl("https://github.com/community")).toThrow();
    expect(safeUrl("", "demo URL", true)).toBeNull();
  });
});

describe("event-local dates", () => {
  it("interprets Singapore local dates independently of the host timezone", () => {
    expect(parseLocalDateTime("2026-11-18T09:30", "Asia/Singapore").toISOString()).toBe("2026-11-18T01:30:00.000Z");
  });

  it("accepts explicit ISO instants and validates local date components", () => {
    expect(parseLocalDateTime("2026-11-18T09:30:00Z", "Asia/Singapore").toISOString()).toBe("2026-11-18T09:30:00.000Z");
    expect(() => parseLocalDateTime("2026-02-30T09:30", "Asia/Singapore")).toThrow();
    expect(() => parseLocalDateTime("2026-11-18T25:30", "Asia/Singapore")).toThrow();
  });

  it("rejects nonexistent spring-forward local times and invalid zones", () => {
    expect(() => parseLocalDateTime("2026-03-08T02:30", "America/New_York")).toThrow();
    expect(() => parseLocalDateTime("2026-11-18T09:30", "Not/A_Zone")).toThrow();
  });
});

describe("window boundaries", () => {
  const event = { status: "ACTIVE", submissionsClosed: false, votingClosed: false, submissionOpensAt: new Date("2026-11-18T00:00Z"), submissionClosesAt: new Date("2026-11-18T12:00Z"), votingOpensAt: new Date("2026-11-18T12:00Z"), votingClosesAt: new Date("2026-11-19T00:00Z") };

  it("opens inclusively and closes exclusively with independent voting dates", () => {
    expect(windowIsOpen(event, "submission", new Date("2026-11-18T00:00Z"))).toBe(true);
    expect(windowIsOpen(event, "submission", new Date("2026-11-18T12:00Z"))).toBe(false);
    expect(windowIsOpen(event, "voting", new Date("2026-11-18T12:00Z"))).toBe(true);
  });

  it("respects ended states and manual closure", () => {
    expect(windowIsOpen({ ...event, status: "ENDED" }, "voting", new Date("2026-11-18T13:00Z"))).toBe(false);
    expect(windowIsOpen({ ...event, votingClosed: true }, "voting", new Date("2026-11-18T13:00Z"))).toBe(false);
  });
});

describe("voucher imports", () => {
  it("reads unique codes or URLs from CSV without importing a header", () => {
    expect(parseVoucherValues("code\nABC123\nABC123\nhttps://sponsor.example/redeem/unique")).toEqual({ values: ["ABC123", "https://sponsor.example/redeem/unique"], duplicates: 1 });
  });

  it("keeps whole lines for headerless redemption URLs and codes", () => {
    const first = "https://sponsor.example/redeem?codes=unique,value";
    const second = "https://sponsor.example/redeem?codes=unique,second";
    const rows = [first, second, "ABC,123", first];
    expect(parseVoucherValues(rows.join("\r\n"))).toEqual({
      values: [first, second, "ABC,123"],
      duplicates: 1,
    });
  });

  it("extracts the voucher column from headered CSV with quoted commas", () => {
    expect(parseVoucherValues('sponsor,code\nAcme,"ABC,123"')).toEqual({
      values: ["ABC,123"],
      duplicates: 0,
    });
  });

  it("rejects dangerous redemption links", () => {
    expect(() => parseVoucherValues("url\njavascript:alert(1)")).toThrow();
  });
});
