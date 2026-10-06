import type { AlertHealth } from '@/lib/setup-status';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The words for an account whose alerts are muted - or null when there is nothing to say.
 *
 * Pure, and it takes the account's own timezone explicitly, so the date a user reads is the date
 * they would say and a test never depends on the machine it runs on.
 */
export function describeMute(alerts: AlertHealth | undefined): { title: string; detail: string } | null {
  if (!alerts?.muted) return null;

  const day = (iso: string | null): string | null => {
    if (!iso) return null;
    const instant = new Date(iso);
    if (Number.isNaN(instant.getTime())) return null;
    // Only the NUMBERS come from Intl (the calendar day in the account's zone). The month name is
    // ours: locale month abbreviations differ between runtime versions ("Jul" on one, "July" on
    // another), and this sentence should read the same on the server, in CI and on a laptop.
    const parts = (timeZone: string) =>
      new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone }).formatToParts(instant);
    let fields: Intl.DateTimeFormatPart[];
    try {
      fields = parts(alerts.timezone);
    } catch {
      fields = parts('Australia/Sydney'); // an unrecognised stored zone must not break the page
    }
    const value = (type: string) => Number(fields.find((part) => part.type === type)?.value);
    const month = MONTHS[value('month') - 1];
    return month ? `${value('day')} ${month} ${value('year')}` : null;
  };

  const lastReached = day(alerts.lastDeliveredAt);
  const since = day(alerts.mutedSince);
  const reach = lastReached
    ? `Nothing has reached you since ${lastReached}.`
    : since
      ? `Nothing has reached you since they were muted on ${since}.`
      : 'Nothing is reaching you.';
  const held =
    alerts.heldBack > 0
      ? ` ${alerts.heldBack.toLocaleString('en-AU')} ${alerts.heldBack === 1 ? 'alert has' : 'alerts have'} been held back.`
      : '';

  return { title: 'Your alerts are muted', detail: `${reach}${held}` };
}
