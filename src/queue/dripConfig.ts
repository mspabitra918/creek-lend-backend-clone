/**
 * Bank-verification drip schedule.
 *
 * The sequence only runs while a loan application sits in
 * `bank_verification_pending`. Emails 1-5 fire at fixed offsets from the moment
 * the lead was submitted; emails 6-8 are anchored to 9:00 AM US Eastern on the
 * following calendar days (the "Next Day" overlap guard) so a 6 AM lead never
 * receives the "next day" message on the same calendar day.
 */

export const DRIP_QUEUE_NAME = "bank-verification-drip";

/** Loan status during which the drip is allowed to run. */
export const DRIP_ACTIVE_STATUS = "bank_verification_pending";

const MIN = 60 * 1000;

export type DripStep =
  | { emailNumber: number; kind: "relative"; afterMs: number }
  | {
      emailNumber: number;
      kind: "calendar";
      dayOffset: number;
      hourET: number;
    };

/**
 * The 8-email timeline. Relative offsets are cumulative from lead submission:
 *   E1 T+0 · E2 +30m · E3 +60m (T+90m) · E4 +120m (T+3.5h) · E5 +240m (T+7.5h).
 * Emails 6-8 anchor to 9:00 AM US-Eastern on the next calendar mornings;
 * `dayOffset` is counted in US-Eastern calendar days.
 */
export const DRIP_STEPS: DripStep[] = [
  { emailNumber: 1, kind: "relative", afterMs: 0 },
  { emailNumber: 2, kind: "relative", afterMs: 30 * MIN },
  { emailNumber: 3, kind: "relative", afterMs: 90 * MIN },
  { emailNumber: 4, kind: "relative", afterMs: 210 * MIN },
  { emailNumber: 5, kind: "relative", afterMs: 450 * MIN },
  { emailNumber: 6, kind: "calendar", dayOffset: 1, hourET: 9 },
  { emailNumber: 7, kind: "calendar", dayOffset: 2, hourET: 9 },
  { emailNumber: 8, kind: "calendar", dayOffset: 3, hourET: 9 },
];

const EASTERN_TZ = "America/New_York";

/** Milliseconds that the given timezone is offset from UTC at `date` (ET - UTC). */
function tzOffsetMs(date: Date, timeZone: string): number {
  // Compare the same instant rendered in the target zone vs. UTC.
  const inTz = new Date(date.toLocaleString("en-US", { timeZone }));
  const inUtc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  return inTz.getTime() - inUtc.getTime();
}

/** The US-Eastern calendar date (year/month/day) of an instant. */
function easternDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = fmt.format(date).split("-").map(Number);
  return { year, month, day };
}

/**
 * Returns the UTC instant for `hourET:00` US-Eastern on the calendar day that is
 * `dayOffset` days after the Eastern calendar day of `from`.
 */
export function easternTimeAt(
  from: Date,
  dayOffset: number,
  hourET: number,
): Date {
  const { year, month, day } = easternDateParts(from);
  // Build the target wall-clock as if it were UTC, then correct by the ET offset.
  const wallClockAsUtc = Date.UTC(
    year,
    month - 1,
    day + dayOffset,
    hourET,
    0,
    0,
  );
  const offset = tzOffsetMs(new Date(wallClockAsUtc), EASTERN_TZ);
  return new Date(wallClockAsUtc - offset);
}

/**
 * Delay in milliseconds (from now) before a step should fire, given when the
 * lead was submitted. Never negative — a step whose time has already passed is
 * scheduled to run immediately.
 */
export function delayForStep(
  step: DripStep,
  submittedAt: Date,
  now: Date = new Date(),
): number {
  if (step.kind === "relative") {
    return Math.max(0, submittedAt.getTime() + step.afterMs - now.getTime());
  }
  const target = easternTimeAt(submittedAt, step.dayOffset, step.hourET);
  return Math.max(0, target.getTime() - now.getTime());
}
