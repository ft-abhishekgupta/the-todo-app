import { addDays, addMonths, addWeeks, setDate, getDay, getDate, getDaysInMonth } from "date-fns";
import { RecurrenceRule } from "@/types";

/**
 * Compute the next scheduled date for a recurring task given the previous
 * scheduled date (or the date the task was completed when no scheduled date
 * exists). Returns null when the recurrence has ended.
 */
export function nextRecurrenceDate(rule: RecurrenceRule, fromDate: Date): Date | null {
  const interval = Math.max(1, rule.interval || 1);
  let next: Date;

  if (rule.type === "daily") {
    next = addDays(fromDate, interval);
  } else if (rule.type === "weekly") {
    if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
      // Find next matching day-of-week. If we're at the end of the week, jump
      // by `interval` weeks then snap to the earliest matching day.
      const sorted = [...rule.daysOfWeek].sort((a, b) => a - b);
      const today = getDay(fromDate);
      const upcoming = sorted.find((d) => d > today);
      if (upcoming !== undefined) {
        next = addDays(fromDate, upcoming - today);
      } else {
        // Wrap to next interval window.
        const weeksAhead = interval;
        const jumpStart = addWeeks(fromDate, weeksAhead);
        next = addDays(jumpStart, sorted[0] - getDay(jumpStart));
      }
    } else {
      next = addWeeks(fromDate, interval);
    }
  } else if (rule.type === "monthly") {
    const targetDay = rule.dayOfMonth || getDate(fromDate);
    const advanced = addMonths(fromDate, interval);
    const maxDay = getDaysInMonth(advanced);
    next = setDate(advanced, Math.min(targetDay, maxDay));
  } else {
    return null;
  }

  if (rule.endDate && next.getTime() > rule.endDate.toDate().getTime()) {
    return null;
  }
  return next;
}
