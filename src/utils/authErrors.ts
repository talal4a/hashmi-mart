/**
 * Firebase Auth error codes → messages we're willing to show a user.
 *
 * Kept in one place so Login, Signup and ForgotPassword can't drift apart,
 * and so raw Firebase strings ("Firebase: Error (auth/…)") never reach the UI.
 */
const MESSAGES: Record<string, string> = {
  'auth/invalid-email': "That email address doesn't look right.",
  'auth/missing-email': 'Enter the email address for your account.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password is too weak — use at least 8 characters.',
  'auth/requires-recent-login': 'Please sign in again to continue.',
  'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
  'auth/network-request-failed':
    'No internet connection. Check your network and try again.',
};

/** Reads `error.code` off an unknown throw and maps it, falling back safely. */
export function authErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const code = (error as { code?: string } | null | undefined)?.code;
  return (code && MESSAGES[code]) || fallback;
}

/** The raw code, for the rare case a caller needs to branch on it. */
export function authErrorCode(error: unknown): string | undefined {
  return (error as { code?: string } | null | undefined)?.code;
}
