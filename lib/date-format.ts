const day = { year: "numeric", month: "short", day: "numeric" } as const;
const clock = { hour: "numeric", minute: "2-digit" } as const;
const formats = {
  date: { locale: "en", options: day },
  dateTime: { locale: "en", options: { ...day, ...clock } },
  dateTimeWithZone: { locale: "en", options: { ...day, ...clock, timeZoneName: "short" } },
  input: {
    locale: "en-GB",
    options: { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  },
} as const;

const formatters = new Map<string, Intl.DateTimeFormat>();

export function dateFormatter(timeZone: string, format: keyof typeof formats) {
  const key = `${format}:${timeZone}`;
  const cached = formatters.get(key);
  if (cached) return cached;

  const { locale, options } = formats[format];
  const formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone });
  if (formatters.size >= 64) formatters.delete(formatters.keys().next().value!);
  formatters.set(key, formatter);
  return formatter;
}
