/**
 * Phone numbers, in one place.
 *
 * The field shows a local number and a fixed dial-code prefix, but what gets
 * stored is E.164 (`+923001234567`) — one canonical form, so a number entered as
 * "0300 123 4567" and the same number entered as "300-1234567" cannot end up as
 * two different values on the same account.
 *
 * A leading zero is dropped rather than rejected. Pakistani numbers are written
 * locally as 03xx, so people type the zero out of habit; keeping it would push
 * the number to 11 digits and make `+9203…` — a number that does not dial.
 */

/** Pakistan. The prefix is fixed rather than picked; see PhoneField. */
export const DIAL_CODE = '+92';

/** Everything that is not a digit, gone, then any leading zeros. */
export function phoneDigits(input: string): string {
  return input.replace(/\D/g, '').replace(/^0+/, '');
}

/** Canonical storage form, or null when there is nothing usable to store. */
export function toE164(input: string, dialCode = DIAL_CODE): string | null {
  const digits = phoneDigits(input);
  return digits ? `${dialCode}${digits}` : null;
}

/**
 * The inverse, for prefilling the field from a stored value: strips our own
 * dial code so the input shows what the user originally typed. A number stored
 * with some other country's code is returned untouched — better a field the user
 * can see and correct than one that silently mangles it.
 */
export function fromE164(stored: string | null, dialCode = DIAL_CODE): string {
  if (!stored) return '';
  return stored.startsWith(dialCode) ? stored.slice(dialCode.length) : stored;
}

/** `3001234567` → `300 123 4567`, purely for display. */
export function groupDigits(digits: string): string {
  const d = phoneDigits(digits);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}
