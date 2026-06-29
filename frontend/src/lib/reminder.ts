// Reach-out reminders are scheduled in IST (FOSS United is India-based). We
// persist an absolute instant (UTC) in the contact's `reach_out_at` field so the
// backend cron only needs a `reach_out_at <= now` check, and convert to/from IST
// here at the edges so the user always picks an IST date + time.

const IST_OFFSET = '+05:30';
export const DEFAULT_REMINDER_TIME = '10:00';

/** Combine an IST date ("YYYY-MM-DD") + time ("HH:MM") into a UTC ISO instant. */
export function istToUtc(date: string, time: string): string {
  if (!date) return '';
  // The explicit +05:30 offset means the browser's own timezone never leaks in.
  return new Date(`${date}T${time || DEFAULT_REMINDER_TIME}:00${IST_OFFSET}`).toISOString();
}

/** Split a stored UTC instant back into IST date + time for the form inputs. */
export function utcToIstParts(stored?: string): { date: string; time: string } {
  if (!stored) return { date: '', time: DEFAULT_REMINDER_TIME };
  // PocketBase returns "YYYY-MM-DD HH:MM:SS.sssZ" (space); normalise to ISO.
  const d = new Date(stored.replace(' ', 'T'));
  if (isNaN(d.getTime())) return { date: '', time: DEFAULT_REMINDER_TIME };
  // Shift into IST, then read the UTC fields of the shifted clock.
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return { date: ist.toISOString().slice(0, 10), time: ist.toISOString().slice(11, 16) };
}
