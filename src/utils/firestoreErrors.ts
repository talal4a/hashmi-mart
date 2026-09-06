/**
 * Firestore error codes → messages we're willing to show a user.
 *
 * The companion to utils/authErrors: a failed profile save is a Firestore
 * failure, not an auth one, and its codes are bare ('unavailable') rather than
 * namespaced ('auth/…'), so the two tables cannot be merged without one of them
 * silently matching the wrong thing.
 *
 * `unavailable` is the one that matters in practice. The web SDK raises it when
 * the device is offline, and its own message ("Failed to get document because
 * the client is offline") is a sentence about a client, addressed to nobody.
 */
const MESSAGES: Record<string, string> = {
  unavailable: 'No internet connection. Check your network and try again.',
  'deadline-exceeded': 'That took too long. Check your connection and retry.',
  cancelled: 'The save was interrupted. Try again.',
  'permission-denied': "You don't have permission to save this profile.",
  unauthenticated: 'Your session has expired. Sign in again to continue.',
  'resource-exhausted': 'Too many requests just now. Try again in a moment.',
  'failed-precondition': "Couldn't save right now. Try again in a moment.",
  internal: 'Something went wrong on our side. Try again.',
};

export function firestoreErrorMessage(
  error: unknown,
  fallback = "Couldn't save your profile. Please try again.",
): string {
  const code = (error as { code?: string } | null | undefined)?.code;
  return (code && MESSAGES[code]) || fallback;
}
