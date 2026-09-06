import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { ensureUserDocument } from './users';

/**
 * Email/password accounts.
 *
 * Firebase owns the credential; this module's only extra job is to make sure
 * `users/{uid}` exists so the profile gate has something to read. Sign-up used
 * to write that document straight from SignupScreen with its own field list,
 * which is how the two paths drifted apart — everything now goes through
 * `ensureUserDocument`, one write, one shape, for both providers.
 *
 * Seeding is non-fatal here exactly as it is for Google (see googleAuth): the
 * session is already valid by the time we try, so an offline blip must not be
 * reported as "sign-up failed" to someone who now has an account. Complete
 * Profile merges into the same id afterwards and creates it if it is missing.
 */
async function seed(
  credential: UserCredential,
  intent: 'sign-up' | 'sign-in',
  name?: string,
): Promise<UserCredential> {
  try {
    await ensureUserDocument(credential.user, 'password', name);
  } catch (error) {
    console.warn(`Could not write users/{uid} on ${intent}:`, error);
  }
  return credential;
}

/**
 * Creates the account. Throws a Firebase error for the caller to translate.
 *
 * The name is written to the Auth profile before the Firestore document so the
 * seed can read `user.displayName` — which is also what every later sign-in
 * reads, so the two can't disagree. Both writes are non-fatal: the account
 * exists the moment `createUserWithEmailAndPassword` resolves, and failing the
 * whole sign-up over a display name would strand a user with credentials they
 * were just told didn't work. The typed name is passed to the seed as well, so
 * an offline `updateProfile` still leaves the profile with a name.
 */
export async function createAccount(
  name: string,
  email: string,
  password: string,
): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  const displayName = name.trim();
  try {
    await updateProfile(credential.user, { displayName });
  } catch (error) {
    console.warn('Could not set the display name on sign-up:', error);
  }
  return seed(credential, 'sign-up', displayName);
}

/**
 * Signs in an existing account.
 *
 * This seeds too, which is not redundant: accounts created before `users/{uid}`
 * existed — or whose write failed at sign-up — get their document on the next
 * login instead of never. For a document that already exists the call only
 * refreshes provider-owned fields, so no profile data is at risk.
 */
export async function signIn(
  email: string,
  password: string,
): Promise<UserCredential> {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  return seed(credential, 'sign-in');
}
