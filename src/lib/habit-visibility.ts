import { Habit } from "@/types";
import { endOfMonth as endOfMonthFn, endOfWeek as endOfWeekFn, format as formatFn, startOfMonth as startOfMonthFn, startOfWeek as startOfWeekFn, eachDayOfInterval } from "date-fns";

// Defaults
export const DEFAULT_WEEKEND_DAYS = [5, 6, 0, 1]; // Fri, Sat, Sun, Mon
export const DEFAULT_MONTH_END_START = 28;
export const DEFAULT_MONTH_END_END = 5; // of next month
export const DEFAULT_QUARTER_END_START = 15; // of last month of quarter
export const DEFAULT_QUARTER_END_END = 7; // of first month of next quarter

const QUARTER_LAST_MONTHS = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec (0-indexed)

function lastDayOfMonth(year: number, monthIdx: number) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

function clampDay(year: number, monthIdx: number, day: number) {
  const last = lastDayOfMonth(year, monthIdx);
  return Math.min(Math.max(1, day), last);
}

function completedInRange(completedDates: ReadonlySet<string> | undefined, start: Date, end: Date): boolean {
  if (!completedDates || completedDates.size === 0) return false;
  for (const d of eachDayOfInterval({ start, end })) {
    if (completedDates.has(formatFn(d, "yyyy-MM-dd"))) return true;
  }
  return false;
}

/**
 * Returns true if the habit should appear on the given local date.
 *
 * Rules (in order):
 *  - Paused habits are never visible.
 *  - frequency=custom → today's weekday must be in customDays (replaces category window).
 *  - frequency=weekly → visible every day of the current week until completed once that week.
 *  - frequency=monthly → visible every day of the current month until completed once that month.
 *  - category=weekend → today's weekday in weekendDays (default Fri-Mon).
 *  - category=month_end → date in [startDay..endOfMonth] of current month
 *      OR [1..endDay] of next month.
 *  - category=quarter_end → similar window across quarter boundary.
 *  - Otherwise: visible every day.
 */
export function isHabitVisibleOn(
  habit: Habit,
  date: Date,
  opts?: { completedDates?: ReadonlySet<string> }
): boolean {
  if (habit.isPaused) return false;

  if (habit.frequency === "custom") {
    const days = habit.customDays && habit.customDays.length > 0 ? habit.customDays : [];
    if (days.length === 0) return true; // misconfigured → fallback visible
    return days.includes(date.getDay());
  }

  if (habit.frequency === "weekly") {
    const start = startOfWeekFn(date, { weekStartsOn: 0 });
    const end = endOfWeekFn(date, { weekStartsOn: 0 });
    return !completedInRange(opts?.completedDates, start, end);
  }

  if (habit.frequency === "monthly") {
    const start = startOfMonthFn(date);
    const end = endOfMonthFn(date);
    return !completedInRange(opts?.completedDates, start, end);
  }

  switch (habit.category) {
    case "weekend": {
      const days = habit.weekendDays && habit.weekendDays.length > 0 ? habit.weekendDays : DEFAULT_WEEKEND_DAYS;
      return days.includes(date.getDay());
    }
    case "month_end": {
      const startDay = clampDay(date.getFullYear(), date.getMonth(), habit.monthEndStartDay ?? DEFAULT_MONTH_END_START);
      const endDay = habit.monthEndEndDay ?? DEFAULT_MONTH_END_END;
      const day = date.getDate();
      // In current month after startDay
      if (day >= startDay) return true;
      // In month after a month-end window: today's day <= endDay (clamped)
      const prevMonth = date.getMonth() === 0 ? 11 : date.getMonth() - 1;
      const prevMonthYear = date.getMonth() === 0 ? date.getFullYear() - 1 : date.getFullYear();
      const prevEndDay = clampDay(date.getFullYear(), date.getMonth(), endDay);
      // Only count "post-window" if previous month had a window starting before its end
      const prevStartDay = clampDay(prevMonthYear, prevMonth, habit.monthEndStartDay ?? DEFAULT_MONTH_END_START);
      const prevHadWindow = prevStartDay <= lastDayOfMonth(prevMonthYear, prevMonth);
      return day <= prevEndDay && prevHadWindow;
    }
    case "quarter_end": {
      const startDay = habit.quarterEndStartDay ?? DEFAULT_QUARTER_END_START;
      const endDay = habit.quarterEndEndDay ?? DEFAULT_QUARTER_END_END;
      const month = date.getMonth();
      const day = date.getDate();
      // In last month of current quarter, after startDay
      if (QUARTER_LAST_MONTHS.includes(month)) {
        const clampedStart = clampDay(date.getFullYear(), month, startDay);
        if (day >= clampedStart) return true;
      }
      // In first month of a quarter (Jan/Apr/Jul/Oct), within first endDay days
      const firstQuarterMonths = [0, 3, 6, 9];
      if (firstQuarterMonths.includes(month)) {
        const clampedEnd = clampDay(date.getFullYear(), month, endDay);
        if (day <= clampedEnd) return true;
      }
      return false;
    }
    default:
      // morning / all_day / night → daily by default
      return true;
  }
}

/** Plain-language preview of the habit's schedule for UI. */
export function describeHabitSchedule(habit: Pick<
  Habit,
  | "frequency"
  | "category"
  | "customDays"
  | "weekendDays"
  | "monthEndStartDay"
  | "monthEndEndDay"
  | "quarterEndStartDay"
  | "quarterEndEndDay"
>): string {
  if (habit.frequency === "custom") {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = habit.customDays && habit.customDays.length > 0
      ? habit.customDays.slice().sort().map((d) => dayNames[d]).join(", ")
      : "any day";
    return `Only on ${days}`;
  }
  if (habit.frequency === "weekly") return "Once per week";
  if (habit.frequency === "monthly") return "Once per month";
  switch (habit.category) {
    case "weekend": {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const days = (habit.weekendDays && habit.weekendDays.length > 0 ? habit.weekendDays : DEFAULT_WEEKEND_DAYS)
        .slice().sort().map((d) => dayNames[d]).join(", ");
      return `Weekend window: ${days}`;
    }
    case "month_end": {
      const s = habit.monthEndStartDay ?? DEFAULT_MONTH_END_START;
      const e = habit.monthEndEndDay ?? DEFAULT_MONTH_END_END;
      return `From day ${s} of each month through day ${e} of the next month`;
    }
    case "quarter_end": {
      const s = habit.quarterEndStartDay ?? DEFAULT_QUARTER_END_START;
      const e = habit.quarterEndEndDay ?? DEFAULT_QUARTER_END_END;
      return `From day ${s} of the last quarter month through day ${e} of the next quarter`;
    }
    default:
      return "Every day";
  }
}
