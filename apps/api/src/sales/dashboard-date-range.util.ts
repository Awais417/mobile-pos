// Centralized, timezone-aware date-range computation for the Admin
// Dashboard's period filter (Today/This Week/This Month/Specific Date/All
// Time) — the single source of truth so this boundary logic is never
// duplicated inline. Boundaries are computed as local calendar time in the
// shop's timezone (SHOP_TIMEZONE env var, falling back to Asia/Karachi) and
// returned as UTC instants ready for a Prisma half-open range
// (`createdAt: { gte: rangeStart, lt: rangeEnd }`) — never the server
// process's own local/UTC clock, which can silently shift a sale into the
// wrong calendar day near midnight if the server isn't running in the
// shop's timezone.

export interface DashboardPeriod {
  key: 'today' | 'week' | 'month' | 'all' | 'date';
  // Required only for 'date' — the shop's local calendar day, 'YYYY-MM-DD'.
  date?: string;
}

export interface DashboardDateRange {
  rangeStart: Date | null;
  rangeEnd: Date | null;
  // Previous equivalent period — used only for the revenueChangePct KPI.
  prevRangeStart: Date | null;
  prevRangeEnd: Date | null;
}

const SHOP_TIMEZONE = process.env.SHOP_TIMEZONE || 'Asia/Karachi';

function zonedYMD(instant: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

// The UTC instant that reads as Y-M-D 00:00:00 in `timeZone` — a single
// correction pass against a naive UTC guess. Exact for fixed-offset zones
// like Asia/Karachi (no DST), and correct for the overwhelming majority of
// calendar days in DST-observing zones too.
function zonedMidnightToUtc(y: number, m: number, d: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const guessInZoneAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  const diff = guessInZoneAsUtc - guess;
  return new Date(guess - diff);
}

// Calendar-date arithmetic only (no timezone/instant involved) — shifting a
// Y-M-D triple by whole days, and reading the weekday of a Y-M-D triple,
// are both properties of the calendar date itself.
function shiftDate(y: number, m: number, d: number, deltaDays: number) {
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + deltaDays);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function weekdayOf(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday, 1 = Monday, ...
}

export function computeDashboardDateRange(
  period: DashboardPeriod,
  now: Date = new Date(),
): DashboardDateRange {
  const today = zonedYMD(now, SHOP_TIMEZONE);
  const midnight = (y: number, m: number, d: number) => zonedMidnightToUtc(y, m, d, SHOP_TIMEZONE);

  if (period.key === 'today') {
    const tomorrow = shiftDate(today.y, today.m, today.d, 1);
    const yesterday = shiftDate(today.y, today.m, today.d, -1);
    const start = midnight(today.y, today.m, today.d);
    return {
      rangeStart: start,
      rangeEnd: midnight(tomorrow.y, tomorrow.m, tomorrow.d),
      prevRangeStart: midnight(yesterday.y, yesterday.m, yesterday.d),
      prevRangeEnd: start,
    };
  }

  if (period.key === 'week') {
    // Monday-start week — days since Monday (0 for Monday, ..., 6 for Sunday).
    const back = (weekdayOf(today.y, today.m, today.d) + 6) % 7;
    const monday = shiftDate(today.y, today.m, today.d, -back);
    const nextMonday = shiftDate(monday.y, monday.m, monday.d, 7);
    const prevMonday = shiftDate(monday.y, monday.m, monday.d, -7);
    const start = midnight(monday.y, monday.m, monday.d);
    return {
      rangeStart: start,
      rangeEnd: midnight(nextMonday.y, nextMonday.m, nextMonday.d),
      prevRangeStart: midnight(prevMonday.y, prevMonday.m, prevMonday.d),
      prevRangeEnd: start,
    };
  }

  if (period.key === 'month') {
    const start = midnight(today.y, today.m, 1);
    const nextMonthY = today.m === 12 ? today.y + 1 : today.y;
    const nextMonthM = today.m === 12 ? 1 : today.m + 1;
    const prevMonthY = today.m === 1 ? today.y - 1 : today.y;
    const prevMonthM = today.m === 1 ? 12 : today.m - 1;
    return {
      rangeStart: start,
      rangeEnd: midnight(nextMonthY, nextMonthM, 1),
      prevRangeStart: midnight(prevMonthY, prevMonthM, 1),
      prevRangeEnd: start,
    };
  }

  if (period.key === 'date') {
    // A date-only string must be read as the shop's local calendar date, not
    // parsed as UTC midnight (which can land on the wrong local day) — so
    // it's split into Y/M/D integers here rather than passed to `new Date()`.
    const isValid = period.date && /^\d{4}-\d{2}-\d{2}$/.test(period.date);
    const [y, m, d] = (
      isValid
        ? period.date!
        : `${today.y}-${String(today.m).padStart(2, '0')}-${String(today.d).padStart(2, '0')}`
    )
      .split('-')
      .map(Number);
    const tomorrow = shiftDate(y, m, d, 1);
    const yesterday = shiftDate(y, m, d, -1);
    const start = midnight(y, m, d);
    return {
      rangeStart: start,
      rangeEnd: midnight(tomorrow.y, tomorrow.m, tomorrow.d),
      prevRangeStart: midnight(yesterday.y, yesterday.m, yesterday.d),
      prevRangeEnd: start,
    };
  }

  // 'all' — no bound at all.
  return { rangeStart: null, rangeEnd: null, prevRangeStart: null, prevRangeEnd: null };
}
