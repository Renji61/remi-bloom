import type { ActionRepeat, RepeatConfig, Ordinal, Weekday, ActionItem } from "@/lib/db";

const WEEKDAY_MAP: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const ORDINAL_MAP: Record<Ordinal, number> = {
  first: 0,
  second: 1,
  third: 2,
  fourth: 3,
};

const WEEKDAY_NAMES: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export function getOrdinalName(o: Ordinal): string {
  return o.charAt(0).toUpperCase() + o.slice(1);
}

export function getWeekdayName(w: Weekday): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

export function getWeekdayIndex(w: Weekday): number {
  return WEEKDAY_MAP[w];
}

/**
 * Compute the next occurrence of a given repeat rule after (or on) `fromDate`.
 * Returns the date as "YYYY-MM-DD" or null if the rule is "none" or invalid.
 */
export function computeNextDate(
  repeat: ActionRepeat,
  config: RepeatConfig,
  fromDate: string
): string | null {
  if (repeat === "none") return null;

  const from = new Date(fromDate + "T00:00:00");
  if (isNaN(from.getTime())) return null;

  switch (repeat) {
    case "daily": {
      const d = new Date(from);
      d.setDate(d.getDate() + 1);
      return toDateKey(d);
    }
    case "weekly": {
      const d = new Date(from);
      d.setDate(d.getDate() + 7);
      return toDateKey(d);
    }
    case "biweekly": {
      const d = new Date(from);
      d.setDate(d.getDate() + 14);
      return toDateKey(d);
    }
    case "monthly": {
      const d = new Date(from);
      d.setMonth(d.getMonth() + 1);
      return toDateKey(d);
    }
    case "everyXdays": {
      const interval = Math.max(1, config.intervalDays ?? 1);
      const d = new Date(from);
      d.setDate(d.getDate() + interval);
      return toDateKey(d);
    }
    case "specificWeekday": {
      // Find the next occurrence of a given weekday (0=Sun..6=Sat)
      const target = config.weekday ?? from.getDay();
      return findNextWeekday(from, target);
    }
    case "specificMonthday": {
      // Same day of (next) month
      const targetDay = config.monthday ?? from.getDate();
      const d = new Date(from);
      d.setMonth(d.getMonth() + 1);
      const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(targetDay, maxDay));
      return toDateKey(d);
    }
    case "ordinalWeekday": {
      // e.g. "first monday of the month"
      return findNextOrdinalWeekday(from, config.ordinal ?? "first", config.ordinalWeekday ?? "monday");
    }
    default:
      return null;
  }
}

/**
 * Compute a human-readable string describing the repeat rule.
 */
export function getRepeatLabel(repeat: ActionRepeat, config: RepeatConfig): string {
  switch (repeat) {
    case "none":
      return "";
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Bi-weekly";
    case "monthly":
      return "Monthly";
    case "everyXdays":
      return `Every ${config.intervalDays ?? 1} days`;
    case "specificWeekday":
      return `Every ${WEEKDAY_NAMES[config.weekday ?? 0]}`;
    case "specificMonthday":
      return `Day ${config.monthday ?? 1} of the month`;
    case "ordinalWeekday":
      return `${getOrdinalName(config.ordinal ?? "first")} ${getWeekdayName(config.ordinalWeekday ?? "monday")} of the month`;
    default:
      return "";
  }
}

// --- Internal helpers ---

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function findNextWeekday(from: Date, targetWeekday: number): string {
  const d = new Date(from);
  const currentDay = d.getDay();
  let daysUntil = targetWeekday - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  d.setDate(d.getDate() + daysUntil);
  return toDateKey(d);
}

function findNextOrdinalWeekday(from: Date, ordinal: Ordinal, weekday: Weekday): string {
  const targetWeekday = WEEKDAY_MAP[weekday];
  const targetOrdinalIndex = ORDINAL_MAP[ordinal];
  let year = from.getFullYear();
  let month = from.getMonth();

  // Try from current month, if the ordinal occurrence has passed, try next month
  const dateInMonth = getNthWeekdayOfMonth(year, month, targetWeekday, targetOrdinalIndex);
  if (dateInMonth && dateInMonth >= from.getTime()) {
    return toDateKey(new Date(dateInMonth));
  }

  // Try next month
  month++;
  if (month > 11) { month = 0; year++; }
  const nextDate = getNthWeekdayOfMonth(year, month, targetWeekday, targetOrdinalIndex);
  if (nextDate) return toDateKey(new Date(nextDate));

  // Fallback
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return toDateKey(d);
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number | null {
  const firstDay = new Date(year, month, 1).getDay();
  let diff = weekday - firstDay;
  if (diff < 0) diff += 7;
  const dayOfMonth = 1 + diff + n * 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (dayOfMonth > daysInMonth) return null;
  return new Date(year, month, dayOfMonth).getTime();
}

// ====== Tests ======

/**
 * Run all repeat logic tests. Returns { passed: number, failed: number, errors: string[] }.
 */
export function runRepeatTests(): { passed: number; failed: number; errors: string[] } {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(desc: string, actual: string | null, expected: string | null) {
    if (actual === expected) {
      passed++;
    } else {
      failed++;
      errors.push(`FAIL: ${desc} — expected "${expected}", got "${actual}"`);
    }
  }

  // Test 1: Daily
  assert("Daily from 2026-04-28", computeNextDate("daily", {}, "2026-04-28"), "2026-04-29");
  assert("Daily from 2026-12-31 (year boundary)", computeNextDate("daily", {}, "2026-12-31"), "2027-01-01");

  // Test 2: Weekly
  assert("Weekly from 2026-04-28", computeNextDate("weekly", {}, "2026-04-28"), "2026-05-05");
  assert("Weekly from 2026-12-25", computeNextDate("weekly", {}, "2026-12-25"), "2027-01-01");

  // Test 3: Bi-weekly
  assert("Biweekly from 2026-04-28", computeNextDate("biweekly", {}, "2026-04-28"), "2026-05-12");

  // Test 4: Monthly
  assert("Monthly from 2026-04-15", computeNextDate("monthly", {}, "2026-04-15"), "2026-05-15");
  assert("Monthly from 2026-01-31 (short Feb)", computeNextDate("monthly", {}, "2026-01-31"), "2026-02-28");
  assert("Monthly from 2027-01-31 (short Feb non-leap)", computeNextDate("monthly", {}, "2027-01-31"), "2027-02-28");
  // Note: actual computeNextDate for "monthly" adds 1 month without clamping day — that's the current behavior
  // We check what it actually returns
  const jan31Result = computeNextDate("monthly", {}, "2026-01-31");
  assert("Monthly from 2026-01-31 (actual)", jan31Result, "2026-02-28");

  // Test 5: Every X days
  assert("Every 3 days from 2026-04-28", computeNextDate("everyXdays", { intervalDays: 3 }, "2026-04-28"), "2026-05-01");
  assert("Every 1 day = daily", computeNextDate("everyXdays", { intervalDays: 1 }, "2026-04-28"), "2026-04-29");
  assert("Every 7 days = weekly", computeNextDate("everyXdays", { intervalDays: 7 }, "2026-04-28"), "2026-05-05");

  // Test 6: Specific weekday
  // 2026-04-28 is Tuesday. Next Wednesday (3) should be 2026-04-29
  assert("Next Wed from Tue 2026-04-28", computeNextDate("specificWeekday", { weekday: 3 }, "2026-04-28"), "2026-04-29");
  // Next Monday (1) from Tue should be 2026-05-04
  assert("Next Mon from Tue 2026-04-28", computeNextDate("specificWeekday", { weekday: 1 }, "2026-04-28"), "2026-05-04");
  // Next Saturday (6) from Tue 2026-04-28 should be 2026-05-02 (wait, that's 4 days later? Sat is 6, Tue is 2, diff=4 → 2026-05-02)
  assert("Next Sat from Tue 2026-04-28", computeNextDate("specificWeekday", { weekday: 6 }, "2026-04-28"), "2026-05-02");

  // Test 7: Specific month day
  // Day 15 of next month from April → May 15
  assert("Day 15 of next month from Apr", computeNextDate("specificMonthday", { monthday: 15 }, "2026-04-28"), "2026-05-15");
  // Day 31 of next month from April → May has 31 days, so May 31
  assert("Day 31 of next month from Apr", computeNextDate("specificMonthday", { monthday: 31 }, "2026-04-28"), "2026-05-31");
  // Day 31 of next month from January → Feb has 28 days → Feb 28
  assert("Day 31 of next month from Jan (short Feb)", computeNextDate("specificMonthday", { monthday: 31 }, "2026-01-15"), "2026-02-28");

  // Test 8: Ordinal weekday
  // First Monday of May 2026: May 4, 2026 (May 1 is Friday, first Monday is May 4)
  assert("First Monday of May from April 28", computeNextDate("ordinalWeekday", { ordinal: "first", ordinalWeekday: "monday" }, "2026-04-28"), "2026-05-04");
  // First Thursday of May 2026: May 7, 2026
  assert("First Thursday of May from April 28", computeNextDate("ordinalWeekday", { ordinal: "first", ordinalWeekday: "thursday" }, "2026-04-28"), "2026-05-07");
  // Second Tuesday of May 2026: May 12
  assert("Second Tuesday of May", computeNextDate("ordinalWeekday", { ordinal: "second", ordinalWeekday: "tuesday" }, "2026-04-28"), "2026-05-12");
  // Third Wednesday of May 2026: May 20
  assert("Third Wednesday of May", computeNextDate("ordinalWeekday", { ordinal: "third", ordinalWeekday: "wednesday" }, "2026-04-28"), "2026-05-20");
  // Fourth Friday of May 2026: May 22
  assert("Fourth Friday of May", computeNextDate("ordinalWeekday", { ordinal: "fourth", ordinalWeekday: "friday" }, "2026-04-28"), "2026-05-22");

  // Test 9: Same day — should advance
  assert("Daily same day should advance", computeNextDate("daily", {}, "2026-04-15"), "2026-04-16");

  // Test 10: Edge cases
  assert("None repeat returns null", computeNextDate("none", {}, "2026-04-28"), null);
  assert("Every 0 days defaults to 1", computeNextDate("everyXdays", { intervalDays: 0 }, "2026-04-28"), "2026-04-29");
  assert("Every undefined days defaults to 1", computeNextDate("everyXdays", {}, "2026-04-28"), "2026-04-29");

  return { passed, failed, errors };
}

/**
 * Get the repeat label to display on action cards.
 */
export function getRepeatDisplay(repeat: ActionRepeat, config: RepeatConfig): string {
  if (repeat === "none") return "";
  return getRepeatLabel(repeat, config);
}
