import dayjs from 'dayjs';

// Single source of truth for "now" in the prototype.
//
// All mock data is anchored to early-2026 (events end Jun 20, orders end Jun 24).
// Freezing "now" to the newest data keeps the default 30-day views populated and
// relative timestamps correct, so the demo never reads as stale — no matter what
// the real calendar says. This is the only place that decides what "now" means.
//
// To make the app track the real date instead, change APP_NOW to `dayjs()`.
export const APP_NOW = dayjs('2026-06-24T17:00:00');

/** Current time as a dayjs instance. Use everywhere instead of `dayjs()`. */
export const now = (): dayjs.Dayjs => APP_NOW;

/** Current time as a native Date. Use instead of `new Date()`. */
export const nowDate = (): Date => APP_NOW.toDate();

/** "YYYY-MM-DD HH:mm" — activity-log style used by event/escalation/message threads. */
export const nowStampIso = (): string => APP_NOW.format('YYYY-MM-DD HH:mm');

/** "MM-DD-YYYY HH:mm" — activity-log style used by the order workflow. */
export const nowStampUs = (): string => APP_NOW.format('MM-DD-YYYY HH:mm');

/** "YYYY-MM-DD" — date-only, for created-at fields. */
export const nowDateStr = (): string => APP_NOW.format('YYYY-MM-DD');
