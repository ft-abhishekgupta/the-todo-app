// Time format helpers. Storage uses HH:mm; UI honors user preference.

export type TimeFormat = "12h" | "24h";

/** Format a stored "HH:mm" time string for display. */
export function formatTimeStr(hhmm: string, fmt: TimeFormat = "12h"): string {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm;
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (fmt === "24h") return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Format hours+minutes (e.g. from a Date) for display. */
export function formatTimeFromDate(date: Date, fmt: TimeFormat = "12h", includeSeconds = false): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  if (fmt === "24h") {
    const base = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return includeSeconds ? `${base}:${String(s).padStart(2, "0")}` : base;
  }
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const base = `${h12}:${String(m).padStart(2, "0")}`;
  return includeSeconds ? `${base}:${String(s).padStart(2, "0")} ${period}` : `${base} ${period}`;
}

/** date-fns format string fragment for a time, based on user preference. */
export function dateFnsTimeFormat(fmt: TimeFormat = "12h", includeSeconds = false): string {
  if (fmt === "24h") return includeSeconds ? "HH:mm:ss" : "HH:mm";
  return includeSeconds ? "h:mm:ss a" : "h:mm a";
}
