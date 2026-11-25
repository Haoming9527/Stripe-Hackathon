import { dateFormatter } from "@/lib/date-format";

export function localDateValue(
  value: Date | string | null | undefined,
  timezone: string,
) {
  if (!value) return "";
  const parts = dateFormatter(timezone, "input").formatToParts(new Date(value));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function eventDate(
  value: Date | string | null | undefined,
  timezone: string,
  includeTime = false,
) {
  if (!value) return "—";
  return dateFormatter(timezone, includeTime ? "dateTime" : "date").format(new Date(value));
}
