/**
 * Initials for the avatar fallback.
 *
 * This runs on every keystroke: Complete Profile shows the fallback disc beside
 * the name field while the user is still typing, so it has to read well for
 * half-written input ("Ta", "Talal ") and not only for finished names.
 *
 * Returns an empty string when there is nothing to work with, which the avatar
 * treats as "draw the person glyph" — a placeholder is better than a "?", which
 * looks like the app failed to load something.
 */
export function initialsFrom(name: string, email?: string | null): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    const first = words[0][0];
    const last = words[words.length - 1][0];
    return (first + last).toUpperCase();
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  // Falling back to the email's local part gives a Google user something on
  // screen before they have typed anything, since the name field may be blank
  // even when the account is years old.
  const local = (email ?? '').trim().split('@')[0];
  const letters = local.replace(/[^a-zA-Z]/g, '');
  return letters.slice(0, 2).toUpperCase();
}
