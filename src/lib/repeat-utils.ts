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
 * Normalize a legacy RepeatConfig to the extended format.
 * Ensures old saved records with the original simple format still work
 * by mapping fields to new equivalents.
 */
export function normalizeRepeatConfig(
  repeat: ActionRepeat,
  config: RepeatConfig
): RepeatConfig {
  const normalized: RepeatConfig = { ...config };

  // Map old "monthday" → new "dayOfMonth"
  if (normalized.monthday !== undefined && normalized.dayOfMonth === undefined) {
    normalized.dayOfMonth = normalized.monthday;
  }

  // If no activeMonths/dormantMonths set, default to all months active
  if (!normalized.activeMonths && !normalized.dormantMonths) {
    // No restriction — all months are active
  }

  // Ensure sensible defaults per repeat type
  switch (repeat) {
    case "yearly":
      normalized.intervalYears ??= 1;
      break;
    case "dynamic":
      normalized.intervalDays ??= 1;
      normalized.dynamicAfterCompletion = true;
      break;
    case "everyXdays":
      normalized.intervalDays ??= 1;
      break;
    case "weekly":
      if (normalized.weekdays?.length) {
        // Multi-day weekly mode — use intervalWeeks
        normalized.intervalWeeks ??= 1;
      }
      break;
    case "monthly":
      if (normalized.monthlyMode === "nthWeekday") {
        normalized.nth ??= 0;
        normalized.weekday ??= 0;
      }
      break;
  }

  return normalized;
}

/**
 * Compute the next occurrence of a given repeat rule after (or on) `fromDate`.
 * Returns the date as "YYYY-MM-DD" or null if the rule is "none" or invalid.
 *
 * For "dynamic" repeat, this returns null — use computeNextDynamicDate instead.
 */
export function computeNextDate(
  repeat: ActionRepeat,
  config: RepeatConfig,
  fromDate: string
): string | null {
  if (repeat === "none") return null;

  const configNorm = normalizeRepeatConfig(repeat, config);
  const from = new Date(fromDate + "T00:00:00");
  if (isNaN(from.getTime())) return null;

  let result: string | null = null;

  switch (repeat) {
    case "daily": {
      const d = new Date(from);
      d.setDate(d.getDate() + 1);
      result = toDateKey(d);
      break;
    }
    case "weekly": {
      // If specific weekdays are set, find next selected weekday
      if (configNorm.weekdays?.length) {
        const intervalWeeks = configNorm.intervalWeeks ?? 1;
        result = findNextSelectedWeekday(from, configNorm.weekdays, intervalWeeks);
      } else {
        const d = new Date(from);
        d.setDate(d.getDate() + 7);
        result = toDateKey(d);
      }
      break;
    }
    case "biweekly": {
      const d = new Date(from);
      d.setDate(d.getDate() + 14);
      result = toDateKey(d);
      break;
    }
    case "monthly": {
      if (configNorm.monthlyMode === "nthWeekday") {
        // Nth weekday of the month
        const nth = configNorm.nth ?? 0;
        const weekday = configNorm.weekday ?? from.getDay();
        result = findNextNthWeekday(from, nth, weekday, configNorm.intervalMonths ?? 1);
      } else if (configNorm.dayOfMonth) {
        // Specific day of month, respecting intervalMonths
        result = advanceToDayOfMonth(from, configNorm.dayOfMonth, configNorm.intervalMonths ?? 1);
      } else {
        // Standard monthly: same day next month
        const d = new Date(from);
        d.setMonth(d.getMonth() + (configNorm.intervalMonths ?? 1));
        result = toDateKey(d);
      }
      break;
    }
    case "everyXdays": {
      const interval = Math.max(1, configNorm.intervalDays ?? 1);
      const d = new Date(from);
      d.setDate(d.getDate() + interval);
      result = toDateKey(d);
      break;
    }
    case "specificWeekday": {
      // Find the next occurrence of a given weekday (0=Sun..6=Sat)
      const target = configNorm.weekday ?? from.getDay();
      result = findNextWeekday(from, target);
      break;
    }
    case "specificMonthday": {
      // Specific day of (next) month
      const targetDay = configNorm.monthday ?? configNorm.dayOfMonth ?? from.getDate();
      const d = new Date(from);
      d.setMonth(d.getMonth() + 1);
      const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(targetDay, maxDay));
      result = toDateKey(d);
      break;
    }
    case "ordinalWeekday": {
      // e.g. "first monday of the month"
      result = findNextOrdinalWeekday(
        from,
        configNorm.ordinal ?? "first",
        configNorm.ordinalWeekday ?? "monday"
      );
      break;
    }
    case "yearly": {
      const years = configNorm.intervalYears ?? 1;
      const d = new Date(from);
      const origMonth = d.getMonth();
      const origDay = d.getDate();
      d.setFullYear(d.getFullYear() + years);
      // Clamp leap year dates (Feb 29 → Feb 28 in non-leap years)
      if (origMonth === 1 && origDay === 29) {
        const daysInFeb = new Date(d.getFullYear(), 2, 0).getDate();
        if (daysInFeb < origDay) {
          d.setDate(daysInFeb);
        }
      }
      result = toDateKey(d);
      break;
    }
    case "dynamic": {
      // Dynamic intervals are only advanced upon explicit completion
      result = null;
      break;
    }
    default:
      return null;
  }

  // Apply active/dormant months filter
  if (result && (configNorm.activeMonths || configNorm.dormantMonths)) {
    result = applyMonthFilter(result, configNorm.activeMonths ?? null, configNorm.dormantMonths ?? null);
  }

  return result;
}

/**
 * Compute the next date for a dynamic interval action.
 * Returns the completionDate + intervalDays.
 * This is called when the user marks an action as completed.
 */
export function computeNextDynamicDate(
  completionDate: string,
  config: RepeatConfig
): string | null {
  const configNorm = normalizeRepeatConfig("dynamic", config);
  const interval = Math.max(1, configNorm.intervalDays ?? 1);
  const d = new Date(completionDate + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + interval);
  return toDateKey(d);
}

/**
 * Compute a human-readable string describing the repeat rule.
 */
export function getRepeatLabel(repeat: ActionRepeat, config: RepeatConfig): string {
  const configNorm = normalizeRepeatConfig(repeat, config);
  switch (repeat) {
    case "none":
      return "";
    case "daily":
      return "Daily";
    case "weekly":
      if (configNorm.weekdays?.length) {
        const dayNames = configNorm.weekdays
          .sort()
          .map((d) => WEEKDAY_NAMES[d])
          .join(", ");
        const interval = configNorm.intervalWeeks ?? 1;
        return interval > 1
          ? `Every ${interval} weeks on ${dayNames}`
          : `Weekly on ${dayNames}`;
      }
      return "Weekly";
    case "biweekly":
      return "Bi-weekly";
    case "monthly":
      if (configNorm.monthlyMode === "nthWeekday") {
        const nthStr =
          configNorm.nth === "last"
            ? "Last"
            : getOrdinalName(
                (["first", "second", "third", "fourth"] as Ordinal[])[
                  (configNorm.nth as number) ?? 0
                ] ?? "first"
              );
        return `${nthStr} ${WEEKDAY_NAMES[configNorm.weekday ?? 0]}`;
      }
      if (configNorm.dayOfMonth) {
        return `Day ${configNorm.dayOfMonth} of the month`;
      }
      return "Monthly";
    case "everyXdays":
      return `Every ${configNorm.intervalDays ?? 1} days`;
    case "specificWeekday":
      return `Every ${WEEKDAY_NAMES[configNorm.weekday ?? 0]}`;
    case "specificMonthday": {
      const day = configNorm.monthday ?? configNorm.dayOfMonth ?? 1;
      return `Day ${day} of the month`;
    }
    case "ordinalWeekday":
      return `${getOrdinalName(configNorm.ordinal ?? "first")} ${getWeekdayName(configNorm.ordinalWeekday ?? "monday")} of the month`;
    case "yearly": {
      const years = configNorm.intervalYears ?? 1;
      return years > 1 ? `Every ${years} years` : "Yearly";
    }
    case "dynamic": {
      const days = configNorm.intervalDays ?? 1;
      return days === 1 ? "Daily (dynamic)" : `Every ${days} days (dynamic)`;
    }
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

/**
 * Find the next occurrence of any of the selected weekdays, respecting intervalWeeks.
 * If the next selected weekday is within the same week (from today), use it.
 * Otherwise advance by intervalWeeks weeks.
 */
function findNextSelectedWeekday(
  from: Date,
  weekdays: number[],
  intervalWeeks: number
): string {
  const sorted = [...weekdays].sort();
  const currentDay = from.getDay();

  // Check if any selected weekday is later this week
  for (const wd of sorted) {
    if (wd > currentDay) {
      const d = new Date(from);
      d.setDate(d.getDate() + (wd - currentDay));
      return toDateKey(d);
    }
  }

  // All selected weekdays have passed this week — advance by intervalWeeks weeks
  // and use the first selected weekday of that week
  const daysUntilNextWeek = (7 - currentDay) + sorted[0];
  const d = new Date(from);
  d.setDate(d.getDate() + daysUntilNextWeek + (intervalWeeks - 1) * 7);
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

/**
 * Find the Nth weekday of a month, handling "last" ordinal.
 * nth: 0..3 for first through fourth, or "last" for the last occurrence.
 */
function findNextNthWeekday(
  from: Date,
  nth: number | "last",
  weekday: number,
  intervalMonths: number
): string {
  let year = from.getFullYear();
  let month = from.getMonth();
  const fromTime = from.getTime();

  // Check current month
  let candidate = getNthWeekdayOfMonthExt(year, month, weekday, nth);
  if (candidate !== null && candidate >= fromTime) {
    return toDateKey(new Date(candidate));
  }

  // Advance by intervalMonths and check
  month += intervalMonths;
  while (month > 11) { month -= 12; year++; }
  candidate = getNthWeekdayOfMonthExt(year, month, weekday, nth);
  if (candidate !== null) {
    return toDateKey(new Date(candidate));
  }

  // Fallback: first of next month
  const d = new Date(from);
  d.setMonth(d.getMonth() + intervalMonths);
  return toDateKey(d);
}

function getNthWeekdayOfMonthExt(
  year: number,
  month: number,
  weekday: number,
  nth: number | "last"
): number | null {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  if (nth === "last") {
    // Find the last occurrence of the given weekday
    const lastDay = new Date(year, month + 1, 0).getDay();
    let diff = weekday - lastDay;
    if (diff > 0) diff -= 7;
    const dayOfMonth = daysInMonth + diff;
    if (dayOfMonth < 1) return null;
    return new Date(year, month, dayOfMonth).getTime();
  }

  const n = nth as number;
  const firstDay = new Date(year, month, 1).getDay();
  let diff = weekday - firstDay;
  if (diff < 0) diff += 7;
  const dayOfMonth = 1 + diff + n * 7;
  if (dayOfMonth > daysInMonth) return null;
  return new Date(year, month, dayOfMonth).getTime();
}

/**
 * Advance to a specific day of the month, respecting intervalMonths.
 * Clamps to last valid day of month (e.g. day 31 → Feb 28).
 */
function advanceToDayOfMonth(
  from: Date,
  dayOfMonth: number,
  intervalMonths: number
): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + intervalMonths);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dayOfMonth, maxDay));
  return toDateKey(d);
}

/**
 * Apply active/dormant months filter to a computed date.
 * If the date falls in a dormant month, advance to the first day of the next active month.
 */
function applyMonthFilter(
  dateStr: string,
  activeMonths: number[] | null,
  dormantMonths: number[] | null
): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1; // 1-based

  let isDormant = false;
  if (dormantMonths?.length) {
    isDormant = dormantMonths.includes(month);
  }
  if (!isDormant && activeMonths?.length) {
    isDormant = !activeMonths.includes(month);
  }

  if (!isDormant) return dateStr;

  // Advance to first day of next active month
  let year = d.getFullYear();
  let candidateMonth = month + 1;
  if (candidateMonth > 12) { candidateMonth = 1; year++; }

  // Loop up to 24 months to find an active month
  for (let i = 0; i < 24; i++) {
    let isCandidateDormant = false;
    if (dormantMonths?.length) {
      isCandidateDormant = dormantMonths.includes(candidateMonth);
    }
    if (!isCandidateDormant && activeMonths?.length) {
      isCandidateDormant = !activeMonths.includes(candidateMonth);
    }
    if (!isCandidateDormant) {
      return `${year}-${String(candidateMonth).padStart(2, "0")}-01`;
    }
    candidateMonth++;
    if (candidateMonth > 12) { candidateMonth = 1; year++; }
  }

  // Fallback: return original date
  return dateStr;
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

  // ── Existing tests (preserved) ──

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
  const jan31Result = computeNextDate("monthly", {}, "2026-01-31");
  assert("Monthly from 2026-01-31 (actual)", jan31Result, "2026-02-28");

  // Test 5: Every X days
  assert("Every 3 days from 2026-04-28", computeNextDate("everyXdays", { intervalDays: 3 }, "2026-04-28"), "2026-05-01");
  assert("Every 1 day = daily", computeNextDate("everyXdays", { intervalDays: 1 }, "2026-04-28"), "2026-04-29");
  assert("Every 7 days = weekly", computeNextDate("everyXdays", { intervalDays: 7 }, "2026-04-28"), "2026-05-05");

  // Test 6: Specific weekday
  assert("Next Wed from Tue 2026-04-28", computeNextDate("specificWeekday", { weekday: 3 }, "2026-04-28"), "2026-04-29");
  assert("Next Mon from Tue 2026-04-28", computeNextDate("specificWeekday", { weekday: 1 }, "2026-04-28"), "2026-05-04");
  assert("Next Sat from Tue 2026-04-28", computeNextDate("specificWeekday", { weekday: 6 }, "2026-04-28"), "2026-05-02");

  // Test 7: Specific month day
  assert("Day 15 of next month from Apr", computeNextDate("specificMonthday", { monthday: 15 }, "2026-04-28"), "2026-05-15");
  assert("Day 31 of next month from Apr", computeNextDate("specificMonthday", { monthday: 31 }, "2026-04-28"), "2026-05-31");
  assert("Day 31 of next month from Jan (short Feb)", computeNextDate("specificMonthday", { monthday: 31 }, "2026-01-15"), "2026-02-28");

  // Test 8: Ordinal weekday
  assert("First Monday of May from April 28", computeNextDate("ordinalWeekday", { ordinal: "first", ordinalWeekday: "monday" }, "2026-04-28"), "2026-05-04");
  assert("First Thursday of May from April 28", computeNextDate("ordinalWeekday", { ordinal: "first", ordinalWeekday: "thursday" }, "2026-04-28"), "2026-05-07");
  assert("Second Tuesday of May", computeNextDate("ordinalWeekday", { ordinal: "second", ordinalWeekday: "tuesday" }, "2026-04-28"), "2026-05-12");
  assert("Third Wednesday of May", computeNextDate("ordinalWeekday", { ordinal: "third", ordinalWeekday: "wednesday" }, "2026-04-28"), "2026-05-20");
  assert("Fourth Friday of May", computeNextDate("ordinalWeekday", { ordinal: "fourth", ordinalWeekday: "friday" }, "2026-04-28"), "2026-05-22");

  // Test 9: Same day — should advance
  assert("Daily same day should advance", computeNextDate("daily", {}, "2026-04-15"), "2026-04-16");

  // Test 10: Edge cases
  assert("None repeat returns null", computeNextDate("none", {}, "2026-04-28"), null);
  assert("Every 0 days defaults to 1", computeNextDate("everyXdays", { intervalDays: 0 }, "2026-04-28"), "2026-04-29");
  assert("Every undefined days defaults to 1", computeNextDate("everyXdays", {}, "2026-04-28"), "2026-04-29");

  // ── New tests ──

  // Test 11: Yearly repeat
  assert("Yearly from Jan 1", computeNextDate("yearly", {}, "2026-01-01"), "2027-01-01");
  assert("Yearly from 2026-06-15", computeNextDate("yearly", {}, "2026-06-15"), "2027-06-15");

  // Test 12: Yearly with leap year clamping (Feb 29 → Feb 28)
  // 2024 is leap, 2025 is not — Feb 29, 2024 → Feb 28, 2025
  assert("Yearly Feb 29 leap to non-leap", computeNextDate("yearly", {}, "2024-02-29"), "2025-02-28");
  // 2024 is leap, 2028 is also leap — Feb 29, 2024 with intervalYears=4 → Feb 29, 2028
  assert("Yearly Feb 29 leap to leap", computeNextDate("yearly", { intervalYears: 4 }, "2024-02-29"), "2028-02-29");

  // Test 13: Monthly with dayOfMonth on short months
  assert("Monthly day 31 from Jan (short Feb)", computeNextDate("monthly", { dayOfMonth: 31, intervalMonths: 1 }, "2026-01-15"), "2026-02-28");
  assert("Monthly day 31 from Mar (31 days → Apr 30)", computeNextDate("monthly", { dayOfMonth: 31, intervalMonths: 1 }, "2026-03-15"), "2026-04-30");

  // Test 14: Monthly nth-weekday (second Tuesday)
  // Second Tuesday of May 2026 = May 12
  assert("Monthly second Tuesday from Apr 28", computeNextDate("monthly", { monthlyMode: "nthWeekday", nth: 1, weekday: 2, intervalMonths: 1 }, "2026-04-28"), "2026-05-12");
  // Second Tuesday of Jun 2026 = Jun 9
  assert("Monthly second Tuesday from May 13", computeNextDate("monthly", { monthlyMode: "nthWeekday", nth: 1, weekday: 2, intervalMonths: 1 }, "2026-05-13"), "2026-06-09");

  // Test 15: Monthly nth-weekday with "last" ordinal
  // Last Monday of Apr 2026 = Apr 27. Apr 28 is after, so should go to last Monday of May = May 25
  assert("Monthly last Monday from Apr 28", computeNextDate("monthly", { monthlyMode: "nthWeekday", nth: "last", weekday: 1, intervalMonths: 1 }, "2026-04-28"), "2026-05-25");

  // Test 16: Weekly with multiple weekdays
  // 2026-04-28 is Tuesday. Selected: Mon, Wed, Fri. Next is Wed Apr 29
  assert("Weekly Mon/Wed/Fri from Tue", computeNextDate("weekly", { weekdays: [1, 3, 5] }, "2026-04-28"), "2026-04-29");
  // From Saturday (day 6), next Mon is Apr 27 + 2 = Apr 29?  No — 2026-04-28 is Tuesday so we need a Sat.
  // Let's use a Monday: 2026-04-27 is Monday. Mon/Wed/Fri: next is Wed Apr 29
  assert("Weekly Mon/Wed/Fri from Mon", computeNextDate("weekly", { weekdays: [1, 3, 5] }, "2026-04-27"), "2026-04-29");
  // From Friday Apr 24, all selected days have passed. Next should be Mon Apr 27
  assert("Weekly Mon/Wed/Fri from Friday", computeNextDate("weekly", { weekdays: [1, 3, 5] }, "2026-04-24"), "2026-04-27");

  // Test 17: Dynamic interval (should return null from computeNextDate)
  assert("Dynamic returns null from computeNextDate", computeNextDate("dynamic", { intervalDays: 3 }, "2026-04-28"), null);

  // Test 18: computeNextDynamicDate
  assert("Dynamic next date from completion", computeNextDynamicDate("2026-04-28", { intervalDays: 3 }), "2026-05-01");
  assert("Dynamic next date same day + 1", computeNextDynamicDate("2026-04-28", {}), "2026-04-29");

  // Test 19: Active/dormant months filter
  // Dormant Nov-Feb from Oct 1 — Oct is active, advances normally
  assert("Dormant Nov-Feb from Oct 1", computeNextDate("daily", { dormantMonths: [1, 2, 11, 12] }, "2026-10-01"), "2026-10-02");
  // From Nov 1 with dormant Nov-Feb: advance to Mar 1 next year
  assert("Dormant Nov-Feb from Nov 1", computeNextDate("daily", { dormantMonths: [11, 12, 1, 2] }, "2026-11-01"), "2027-03-01");
  // From Dec 15 with dormant Nov-Feb: advance to Mar 1 next year
  assert("Dormant Nov-Feb from Dec 15", computeNextDate("daily", { dormantMonths: [11, 12, 1, 2] }, "2026-12-15"), "2027-03-01");
  // From Mar 15 — March is active, should advance normally
  assert("Dormant Nov-Feb from Mar 15 (active)", computeNextDate("daily", { dormantMonths: [11, 12, 1, 2] }, "2027-03-15"), "2027-03-16");
  // Active months only Apr-Sep: from Oct 1 should advance to Apr next year
  assert("Active Apr-Sep from Oct 1", computeNextDate("daily", { activeMonths: [4, 5, 6, 7, 8, 9] }, "2026-10-01"), "2027-04-01");
  // From Apr 15 (active): should advance normally
  assert("Active Apr-Sep from Apr 15", computeNextDate("daily", { activeMonths: [4, 5, 6, 7, 8, 9] }, "2027-04-15"), "2027-04-16");

  // Test 20: normalizeRepeatConfig
  assert("normalize cleanup: monthly mode", computeNextDate("specificMonthday", { monthday: 15 }, "2026-04-28"), "2026-05-15");

  // Test 21: Yearly with intervalYears=2
  assert("Yearly every 2 years", computeNextDate("yearly", { intervalYears: 2 }, "2026-06-15"), "2028-06-15");

  return { passed, failed, errors };
}

/**
 * Get the repeat label to display on action cards.
 */
export function getRepeatDisplay(repeat: ActionRepeat, config: RepeatConfig): string {
  if (repeat === "none") return "";
  return getRepeatLabel(repeat, config);
}
