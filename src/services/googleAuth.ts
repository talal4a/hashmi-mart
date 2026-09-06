import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { ensureUserDocument, forgetUserDocument } from './users';

// Web client ID (type 3) from google-services.json / Firebase Console → OAuth
const WEB_CLIENT_ID =
  '886326794185-qvn3icsb25bg63271ev56p5j51ole4pv.apps.googleusercontent.com';

// Must be called once at app startup (e.g. App.tsx or index.js)
export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    offlineAccess: true,
  });
}

/**
 * The library changed its response shape in v13:
 *   v13+  → { type: 'success' | 'cancelled', data: { idToken, user, ... } | null }
 *   v12-  → { idToken, user, ... }, and it *threw* SIGN_IN_CANCELLED on cancel.
 * We accept both so the code doesn't depend on which version npm resolves.
 */
type AnySignInResponse = {
  type?: string;
  data?: { idToken?: string | null } | null;
  idToken?: string | null;
};

function readIdToken(response: unknown): string | null {
  const r = response as AnySignInResponse | null;
  return r?.data?.idToken ?? r?.idToken ?? null;
}

/** True when the native sheet was dismissed by the user rather than failing. */
export function isCancelledError(error: unknown): boolean {
  const code = (error as { code?: string | number } | null | undefined)?.code;
  return code != null && String(code) === String(statusCodes.SIGN_IN_CANCELLED);
}

/**
 * A Google failure in words a shopper can act on.
 *
 * The screens used to show `error.message`, which for this flow means text like
 * "Google did not return an ID token. Check that webClientId is the Web client
 * ID (client_type 3)…" — a note to the developer, rendered in a modal, to
 * someone trying to buy groceries. Everything unrecognised collapses to one
 * plain sentence; the detail still reaches the console for whoever is debugging.
 *
 * '10' is Android's DEVELOPER_ERROR, raised when the release build's SHA-1 is
 * missing from the Firebase project. It gets its own message because it is the
 * one failure that is reproducible for every user of a broken build, so a
 * "try again" would be a lie.
 */
export function googleErrorMessage(error: unknown): string {
  const code = String(
    (error as { code?: string | number } | null | undefined)?.code ?? '',
  );

  if (code === String(statusCodes.PLAY_SERVICES_NOT_AVAILABLE)) {
    return 'Google Play services is out of date on this device. Update it and try again.';
  }
  if (code === String(statusCodes.IN_PROGRESS)) {
    return 'A sign-in is already in progress.';
  }
  if (code === '10') {
    return "Google sign-in isn't set up for this version of the app yet.";
  }
  if (code === 'auth/network-request-failed') {
    return 'No internet connection. Check your network and try again.';
  }
  return "Couldn't sign in with Google. Please try again.";
}

/**
 * Triggers native Google Sign-In, exchanges the ID token for a Firebase
 * session, then makes sure `users/{uid}` exists (see ./users).
 *
 * @returns the UserCredential on success, or `null` if the user cancelled.
 *          Any other failure throws.
 */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  let response: unknown;
  try {
    response = await GoogleSignin.signIn();
  } catch (error) {
    if (isCancelledError(error)) return null;
    throw error;
  }

  if ((response as AnySignInResponse)?.type === 'cancelled') return null;

  const idToken = readIdToken(response);
  if (!idToken) {
    throw new Error(
      'Google did not return an ID token. Check that webClientId is the Web ' +
        'client ID (client_type 3) from google-services.json.',
    );
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);

  // Seeding the profile document is deliberately non-fatal: the Firebase
  // session is already valid here, so an offline blip or a rules rejection
  // must not surface as "Google Sign-In failed" and strand a signed-in user.
  try {
    await ensureUserDocument(userCredential.user, 'google');
  } catch (error) {
    console.warn('Could not write users/{uid} document:', error);
  }

  return userCredential;
}

/**
 * Restores a previous Google session without showing UI.
 */
export async function isGoogleSignedIn(): Promise<boolean> {
  try {
    const response = await GoogleSignin.signInSilently();
    const type = (response as AnySignInResponse)?.type;
    // v13+ resolves with 'noSavedCredentialFound' instead of throwing.
    if (type) return type === 'success';
    return readIdToken(response) !== null;
  } catch {
    return false;
  }
}

/**
 * Signs out of both Google and Firebase. Keeps the OAuth grant, so the next
 * sign-in can reuse the remembered account.
 *
 * Callers do not wait for this — Complete Profile resets to Onboarding first and
 * lets it finish in the background — so the cached profile document is dropped
 * synchronously, on the way in. Nothing may hand it to the next session.
 *
 * The two sign-outs run in parallel and neither can block the other, which is
 * about correctness rather than speed: nobody is waiting, but they used to be
 * sequential with Google's native call first, and Google's is the one that can
 * hang or reject when the native module has not been rebuilt into the app. A
 * stalled Google call would have taken the *Firebase* sign-out with it and left
 * the user on Onboarding with a live session — one that a relaunch would happily
 * restore back into Home. Firebase holds the session of record, so it cannot sit
 * behind anything.
 */
export async function signOutGoogle() {
  forgetUserDocument();
  const [google, firebase] = await Promise.allSettled([
    // Fails when there is no Google session — harmless and expected for an
    // email/password account.
    GoogleSignin.signOut(),
    firebaseSignOut(auth),
  ]);
  if (google.status === 'rejected') {
    console.warn(
      'Google sign-out failed (session may not exist):',
      google.reason,
    );
  }
  // The one that matters: re-thrown so the caller's own catch can log it, and so
  // a caller that *does* await knows the session is still live.
  if (firebase.status === 'rejected') throw firebase.reason;
}

/**
 * Fully revokes the OAuth grant, forcing the account picker next time.
 * Use for "disconnect account", not for ordinary sign-out.
 */
export async function revokeGoogleAccess() {
  try {
    await GoogleSignin.revokeAccess();
  } catch {
    // Nothing to revoke.
  }
  await signOutGoogle();
}
