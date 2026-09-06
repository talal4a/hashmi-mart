import {
  NAME_MIN,
  PHONE_MIN_DIGITS,
  userRoleSchema,
} from '../validation/Schema';
import { phoneDigits } from '../utils/phone';
import {
  markProfileComplete,
  peekUserDocument,
  readUserDocument,
  type UserDocument,
} from './users';

/**
 * Where a signed-in user belongs: the one place that decides whether a profile
 * counts as finished.
 *
 * Kept out of the screens and out of the navigator so the answer cannot differ
 * between the splash gate, the post-sign-in redirect and Complete Profile's own
 * mount check — three callers that all have to agree or the user ends up in a
 * loop.
 */
export type AuthDestination = 'Home' | 'CompleteProfile';

/**
 * How old a cached document may be and still answer the routing question: about
 * as long as a sign-in hand-off can reasonably take. Deliberately far shorter
 * than the cache's own lifetime — this is the one decision that must not be made
 * on a document that has had time to change.
 */
const HANDOFF_MS = 5000;

/**
 * The fields the routing decision actually reads, as a structural minimum
 * rather than the full `UserDocument`: the gate must stay callable with any
 * object that carries these facts, however it was built or read — a document
 * straight from Firestore, a normalised one, or a hand-built one in tests.
 */
export type ProfileFacts = Pick<
  UserDocument,
  'name' | 'phone' | 'role' | 'profileComplete'
>;

/**
 * Does the stored document actually hold a usable profile, flag aside?
 *
 * Legacy accounts may have a completion flag but no role. They must choose one
 * in Complete Profile; their other stored details remain available to prefill.
 *
 * The thresholds are the form's own (`NAME_MIN`, `PHONE_MIN_DIGITS`), imported
 * rather than restated: a document that would fail the form must not pass here.
 */
export function hasProfileDetails(profile: ProfileFacts): boolean {
  const named = profile.name.trim().length >= NAME_MIN;
  const dialable = phoneDigits(profile.phone ?? '').length >= PHONE_MIN_DIGITS;
  const hasRole = userRoleSchema.safeParse(profile.role).success;
  return named && dialable && hasRole;
}

/** Required data is authoritative; an old completion flag cannot bypass it. */
export function isProfileComplete(profile: ProfileFacts): boolean {
  return hasProfileDetails(profile);
}

/**
 * Reads `users/{uid}` and answers where to send the user.
 *
 * Takes the UID rather than the `User` so callers can depend on a string: the
 * auth listener hands out a fresh `User` object on every token refresh, and a
 * hook keyed on that identity would re-read Firestore for no reason.
 *
 * Never throws. A failed read resolves to 'CompleteProfile' rather than 'Home'
 * because the brief's hard rule is that nobody with an unverified profile lands
 * in the app; the cost is that an already-complete user who opens the app with
 * no connection sees that screen, which is why CompleteProfileScreen re-checks
 * on mount and forwards silently when the document turns out to be complete.
 *
 * A document with all required details but no flag is backfilled here to keep
 * the stored metadata current. That write is non-fatal; the required data is
 * checked on every hand-off regardless of the flag.
 */
export async function resolveAuthDestination(
  uid: string,
): Promise<AuthDestination> {
  // Both sign-in paths seed `users/{uid}` immediately before asking this, and
  // seeding reads the document to decide whether to create it. Reusing an answer
  // that is a moment old removes a whole round trip from the one hand-off the user
  // is actively waiting through, and cannot differ from a fresh read: nothing but
  // this device has touched the document in between. The launch gate has no such
  // read behind it, so it misses and reads, as it should.
  const seeded = peekUserDocument(uid, HANDOFF_MS);

  let profile: UserDocument | null;
  if (seeded) {
    profile = seeded.profile;
  } else {
    try {
      profile = await readUserDocument(uid);
    } catch (error) {
      console.warn(
        'Could not read users/{uid}; routing to Complete Profile:',
        error,
      );
      return 'CompleteProfile';
    }
  }

  if (!profile || !isProfileComplete(profile)) return 'CompleteProfile';
  if (profile.profileComplete) return 'Home';

  try {
    await markProfileComplete(uid);
  } catch (error) {
    console.warn('Could not backfill profileComplete:', error);
  }
  return 'Home';
}
