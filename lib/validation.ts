import Papa from "papaparse";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new DomainError(message);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(value);
}

export function field(form: FormData, key: string, max = 10_000): string {
  const value = form.get(key);
  assert(value === null || typeof value === "string", `${key} must be text.`);
  const text = (value ?? "").trim();
  assert(text.length <= max, `${key} is too long (maximum ${max} characters).`);
  return text;
}

export function required(
  form: FormData,
  key: string,
  label: string,
  max = 200,
): string {
  const value = field(form, key, max);
  assert(value, `Enter ${label}.`);
  return value;
}

export function flag(form: FormData, key: string): boolean {
  return ["true", "on", "1", "yes"].includes(field(form, key, 20));
}

export function integer(
  form: FormData,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = field(form, key, 20);
  const value = raw === "" ? fallback : Number(raw);
  assert(
    Number.isInteger(value) && value >= min && value <= max,
    `${key} must be a whole number from ${min} to ${max}.`,
  );
  return value;
}

export function safeUrl(
  value: string,
  label: string,
  optional = false,
): string | null {
  if (!value && optional) return null;
  assert(value, `Enter ${label}.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DomainError(`Enter a valid ${label}.`);
  }
  assert(
    ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !!url.hostname,
    `${label} must be an HTTP or HTTPS link without credentials.`,
  );
  assert(value.length <= 2048, `${label} is too long.`);
  return url.toString();
}

export function githubUrl(value: string): string {
  const parsed = new URL(safeUrl(value, "GitHub repository URL")!);
  assert(
    parsed.hostname.toLowerCase() === "github.com" &&
      /^\/[^/]+\/[^/]+\/?$/.test(parsed.pathname),
    "Enter a GitHub repository URL such as https://github.com/team/project.",
  );
  return parsed.toString();
}

function dateParts(date: Date, timezone: string): number[] {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return ["year", "month", "day", "hour", "minute", "second"].map((key) =>
    Number(parts.find((p) => p.type === key)!.value),
  );
}

export function validTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
  } catch {
    throw new DomainError(
      "Choose a valid IANA timezone, such as Asia/Singapore.",
    );
  }
  return value;
}

/** Interpret datetime-local in the event's timezone, never in the server's timezone. */
export function parseLocalDateTime(
  value: string,
  timezone: string,
  label = "date",
): Date {
  validTimezone(timezone);
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    const date = new Date(value);
    assert(!Number.isNaN(date.getTime()), `Enter a valid ${label}.`);
    return date;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  assert(match, `Enter ${label}.`);
  const expected = match.slice(1).map((part) => Number(part || 0));
  const [year, month, day, hour, minute, second] = expected;
  assert(
    year >= 2000 && year <= 2200,
    `${label} must be between 2000 and 2200.`,
  );
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = wall;
  for (let i = 0; i < 4; i++) {
    const [y, m, d, h, min, sec] = dateParts(new Date(instant), timezone);
    const difference = wall - Date.UTC(y, m - 1, d, h, min, sec);
    instant += difference;
    if (!difference) break;
  }
  const actual = dateParts(new Date(instant), timezone);
  assert(
    expected.every((part, i) => part === actual[i]),
    `${label} is invalid or falls in a daylight-saving clock change.`,
  );
  return new Date(instant);
}

export type ImportParticipant = {
  normalizedEmail: string;
  name: string | null;
};
export type ParticipantImport = {
  participants: ImportParticipant[];
  invalid: string[];
  duplicates: number;
};

export function parseParticipants(text: string): ParticipantImport {
  assert(
    text.length <= 1_000_000,
    "The import is too large. Use a file smaller than 1 MB.",
  );
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  });
  assert(
    parsed.errors.every((error) => error.code === "UndetectableDelimiter"),
    "The CSV could not be read. Check quoted values and try again.",
  );
  assert(
    parsed.data.length <= 5001,
    "Import at most 5,000 participants at a time.",
  );
  const first =
    parsed.data[0]?.map((value) => value.trim().toLowerCase()) ?? [];
  const emailColumn = first.findIndex((value) =>
    ["email", "email address", "normalizedemail"].includes(value),
  );
  const nameColumn = first.findIndex((value) =>
    ["name", "full name"].includes(value),
  );
  const candidates =
    emailColumn >= 0
      ? parsed.data
          .slice(1)
          .map((row) => ({
            email: row[emailColumn] ?? "",
            name: nameColumn >= 0 ? row[nameColumn] : null,
          }))
      : parsed.data.flatMap((row) =>
          row.flatMap((value) =>
            value.split(/[;\n\r]+/).map((email) => ({ email, name: null })),
          ),
        );
  assert(
    candidates.length <= 5000,
    "Import at most 5,000 participants at a time.",
  );
  const seen = new Set<string>();
  const participants: ImportParticipant[] = [];
  const invalid: string[] = [];
  let duplicates = 0;
  for (const [index, candidate] of candidates.entries()) {
    const email = normalizeEmail(candidate.email);
    if (!email) {
      if (emailColumn >= 0) invalid.push(`Missing email in CSV record ${index + 2}`);
      continue;
    }
    if (!isEmail(email)) {
      invalid.push(candidate.email.slice(0, 100));
      continue;
    }
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);
    participants.push({
      normalizedEmail: email,
      name: candidate.name?.trim().slice(0, 100) || null,
    });
  }
  return { participants, invalid, duplicates };
}

export function parseVoucherValues(text: string): {
  values: string[];
  duplicates: number;
} {
  assert(
    text.length <= 1_000_000,
    "The import is too large. Use a file smaller than 1 MB.",
  );
  const source = text.trim();
  const parsed = Papa.parse<string[]>(source, {
    skipEmptyLines: "greedy",
  });
  const first =
    parsed.data[0]?.map((value) => value.trim().toLowerCase()) ?? [];
  const column = /^https?:\/\//i.test(source)
    ? -1
    : first.findIndex((value) =>
        ["code", "url", "link", "value", "redemption_url"].includes(value),
      );
  let cells: string[];
  if (column >= 0) {
    assert(
      parsed.errors.every((error) => error.code === "UndetectableDelimiter"),
      "The CSV could not be read. Check quoted values and try again.",
    );
    cells = parsed.data.slice(1).map((row) => row[column] ?? "");
  } else {
    cells = source.split(/\r\n|[\r\n]/);
  }
  const candidates = cells.map((value) => value.trim()).filter(Boolean);
  assert(candidates.length <= 5000, "Import at most 5,000 vouchers at a time.");
  assert(
    candidates.every((value) => value.length <= 4096),
    "A voucher exceeds 4,096 characters.",
  );
  for (const value of candidates) {
    if (/^[a-z][a-z\d+.-]*:/i.test(value)) safeUrl(value, "redemption link");
  }
  return {
    values: [...new Set(candidates)],
    duplicates: candidates.length - new Set(candidates).size,
  };
}

export function windowIsOpen(
  event: {
    status: string;
    submissionsClosed: boolean;
    votingClosed: boolean;
    submissionOpensAt: Date;
    submissionClosesAt: Date;
    votingOpensAt: Date;
    votingClosesAt: Date;
  },
  kind: "submission" | "voting",
  now = new Date(),
): boolean {
  if (event.status !== "ACTIVE") return false;
  return kind === "submission"
    ? !event.submissionsClosed &&
        now >= event.submissionOpensAt &&
        now < event.submissionClosesAt
    : !event.votingClosed &&
        now >= event.votingOpensAt &&
        now < event.votingClosesAt;
}
