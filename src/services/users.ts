import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../config/firebase';
import {
  GENDERS,
  userRoleSchema,
  type Gender,
  type UserRole,
} from '../validation/Schema';

const USERS = 'users';

export type AuthProvider = 'google' | 'password';

/**
 * Shape stored at `users/{uid}` — one document per account, keyed by the Firebase
 * Auth UID, which is why nothing here can create a duplicate however many times
 * it runs.
 *
 * `role`, `phone`, `address`, `gender` and `avatarId` are null until Complete Profile
 * fills them: Google hands us a name, an email and an avatar URL and never a
 * phone number, and email/password sign-up now asks for neither.
 *
 * There are two picture fields and they are not interchangeable. `photoURL` is
 * provider-owned — `ensureUserDocument` re-seeds it from Google on every sign-in,
 * so anything user-chosen written there would be silently overwritten the next
 * time they logged in. `avatarUrl` is the user's own upload and is only ever
 * written by Complete Profile.
 */
export type UserDocument = {
  name: string;
  email: string;
  /** User-selected account type; does not grant privileged backend permissions. */
  role: UserRole | null;
  phone: string | null;
  address: string | null;
  gender: Gender | null;
  /** From the Google account, when there is one. Provider-owned; do not repurpose. */
  photoURL: string | null;
  /** A photo the user uploaded themselves, stored in Cloudinary. Beats photoURL. */
  avatarUrl: string | null;
  /** Cloudinary public_id for that upload, so the asset can be found again. */
  avatarPublicId: string | null;
  /** Id of a chosen built-in avatar; overrides both URLs for display. */
  avatarId: string | null;
  provider: AuthProvider;
  profileComplete: boolean;
};

/** The subset Complete Profile owns. */
export type ProfileDetails = {
  role: UserRole;
  name: string;
  phone: string;
  gender?: Gender;
  address?: string | null;
  avatarId?: string | null;
  avatarUrl?: string | null;
  avatarPublicId?: string | null;
  /**
   * Provider-owned, passed through only because this write may be the one that
   * creates the document. Ignored when falsy, so it can never blank a stored
   * value.
   */
  email?: string | null;
  photoURL?: string | null;
};

function userRef(uid: string) {
  return doc(db, USERS, uid);
}

/**
 * `getDoc` waits for the server for as long as the channel takes to establish,
 * and a channel that is neither up nor down (a stalled handshake) hangs it with
 * no error and no timeout — Complete Profile then renders an empty screen for
 * as long as that takes, which on a flaky connection is forever. Racing the
 * read against a timer turns that state into the ordinary read failure, which
 * every caller already handles: the hook shows the form with the offline
 * notice, the gate routes to Complete Profile, and setDoc commits locally and
 * syncs once the network returns. The abandoned getDoc is left to settle on its
 * own; its result is simply ignored.
 */
const READ_TIMEOUT_MS = 8000;

function raceRead<T>(read: Promise<T>): Promise<T> {
  return Promise.race([
    read,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Firestore read timed out')),
        READ_TIMEOUT_MS,
      ),
    ),
  ]);
}

const str = (value: unknown): string =>
  typeof value === 'string' ? value : '';
const strOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * Fills in every field this app expects, whatever the document actually holds.
 *
 * Documents written before this shape existed have only `{ name, email, phone,
 * createdAt }`, so every consumer would otherwise need its own undefined checks.
 * One normalising read here means the rest of the app can treat the profile as a
 * complete object.
 *
 * A missing `provider` is read as 'password': the Google path has always written
 * that field, so its absence identifies an old email/password document.
 */
function normalise(data: DocumentData): UserDocument {
  const gender = data.gender;
  const role = userRoleSchema.safeParse(data.role);
  return {
    name: str(data.name),
    email: str(data.email),
    role: role.success ? role.data : null,
    phone: strOrNull(data.phone),
    address: strOrNull(data.address),
    gender: (GENDERS as readonly string[]).includes(gender)
      ? (gender as Gender)
      : null,
    photoURL: strOrNull(data.photoURL),
    avatarUrl: strOrNull(data.avatarUrl),
    avatarPublicId: strOrNull(data.avatarPublicId),
    avatarId: strOrNull(data.avatarId),
    provider: data.provider === 'google' ? 'google' : 'password',
    profileComplete: data.profileComplete === true,
  };
}

/**
 * The last version of a user document this module saw, kept in memory only.
 *
 * Every sign-in already reads `users/{uid}` twice: once to seed it
 * (`ensureUserDocument`) and once to decide where to go (`resolveAuthDestination`)
 * — and then Complete Profile read it a third time to prefill the form. Those
 * three reads happen inside a second of each other and cannot disagree, so the
 * second and third were paying a round-trip for an answer already in hand. That
 * round-trip is what the spinner on Complete Profile was: the form could not be
 * drawn until a network read that had already happened came back again.
 *
 * Cached against the uid it belongs to, so it can never be handed to a different
 * account, and stamped, so it can never answer for a document that has had time
 * to change elsewhere. `{ profile }` is a hit holding nothing (no document);
 * `null` is a miss. Confusing the two would make a first-time user look like a
 * returning one.
 *
 * It is written on read *and* on write: every mutation here knows exactly what it
 * changed, so keeping the cache correct costs nothing, and a write that cannot be
 * mirrored exactly clears it rather than guessing.
 */
type CachedDocument = { uid: string; profile: UserDocument | null; at: number };

let cached: CachedDocument | null = null;

/**
 * How long a cached document may answer for. Long enough to cover a sign-in
 * handing off to Complete Profile, short enough that a document edited on another
 * device is not what the form prefills from.
 */
const FRESH_MS = 30_000;

function remember(uid: string, profile: UserDocument | null) {
  cached = { uid, profile, at: Date.now() };
}

/** The cached document, or null when there isn't a fresh one for this uid. */
export function peekUserDocument(
  uid: string,
  maxAgeMs: number = FRESH_MS,
): { profile: UserDocument | null } | null {
  if (!cached || cached.uid !== uid) return null;
  if (Date.now() - cached.at > maxAgeMs) return null;
  return { profile: cached.profile };
}

/** Drops the cache. Called on sign-out so nothing outlives the session. */
export function forgetUserDocument() {
  cached = null;
}

/**
 * Creates `users/{uid}` the first time an account signs in, for either provider.
 *
 * On every later sign-in this refreshes only the fields the provider owns. It
 * must never rewrite `role`, `name`, `phone`, `address`, `gender`, `avatarId`, `avatarUrl`
 * or `avatarPublicId`: those become user-edited values, and re-seeding them would
 * wipe the profile on each login.
 *
 * `fallbackName` covers the gap between creating an account and Firebase knowing
 * its display name: email sign-up calls `updateProfile` first, but that call is
 * allowed to fail offline, and the typed name is worth more than an empty string.
 * It is read only on create, for the same reason nothing else is.
 */
export async function ensureUserDocument(
  user: User,
  provider: AuthProvider,
  fallbackName?: string,
): Promise<'created' | 'updated'> {
  const ref = userRef(user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    const created: UserDocument = {
      name: user.displayName || fallbackName?.trim() || '',
      email: user.email ?? '',
      role: null,
      phone: null,
      address: null,
      gender: null,
      photoURL: user.photoURL ?? null,
      avatarUrl: null,
      avatarPublicId: null,
      avatarId: null,
      provider,
      profileComplete: false,
    };
    await setDoc(ref, {
      ...created,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    remember(user.uid, created);
    return 'created';
  }

  const email = user.email ?? snapshot.get('email') ?? '';
  const photoURL = user.photoURL ?? snapshot.get('photoURL') ?? null;

  await setDoc(
    ref,
    { email, photoURL, updatedAt: serverTimestamp() },
    { merge: true },
  );
  remember(user.uid, normalise({ ...snapshot.data(), email, photoURL }));
  return 'updated';
}

/**
 * The stored profile, normalised, or null when the document doesn't exist.
 *
 * Always goes to Firestore. Callers that would accept a just-read answer should
 * try `peekUserDocument` first — this one is what refreshes it.
 */
export async function readUserDocument(
  uid: string,
): Promise<UserDocument | null> {
  const snapshot = await raceRead(getDoc(userRef(uid)));
  const profile = snapshot.exists() ? normalise(snapshot.data()) : null;
  remember(uid, profile);
  return profile;
}

/**
 * Writes what Complete Profile collected and flips the completion flag.
 *
 * `setDoc(…, { merge: true })` rather than `updateDoc` on purpose: seeding the
 * document at sign-in is deliberately non-fatal (see googleAuth), so a user can
 * legitimately reach this screen with no document at all. `updateDoc` would fail
 * for exactly the person who most needs this to succeed, while merge creates it.
 * Either way the id is the UID, so this cannot fork into a second document.
 *
 * `email` and `photoURL` ride along for that same reason. When this write is the
 * one creating the document, leaving them out would store a profile that no
 * human could match back to an account; when the document already exists they
 * are the two fields the provider owns anyway, and both are skipped rather than
 * written as null, so a merge can only ever fill them in.
 *
 * The three avatar fields are written unconditionally, including as null, because
 * the form holds the current value of each and clearing a picture has to be a
 * thing a user can do. `avatarUrl` and `avatarPublicId` move together or not at
 * all: a URL with no id cannot be cleaned up later, and an id with no URL is a
 * record of an asset nothing displays.
 */
export async function saveProfileDetails(uid: string, details: ProfileDetails) {
  // Validate at the write boundary too: a completion flag never substitutes for
  // an explicit role, even when this service is called outside the form.
  const role = userRoleSchema.parse(details.role);
  await setDoc(
    userRef(uid),
    {
      role,
      name: details.name,
      phone: details.phone,
      gender: details.gender ?? null,
      address: details.address ?? null,
      avatarId: details.avatarId ?? null,
      avatarUrl: details.avatarUrl ?? null,
      avatarPublicId: details.avatarPublicId ?? null,
      ...(details.email ? { email: details.email } : null),
      ...(details.photoURL ? { photoURL: details.photoURL } : null),
      profileComplete: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  // What was cached is now behind the document. Nothing reads it between here and
  // Home, so dropping it is cheaper and safer than mirroring the merge.
  forgetUserDocument();
}

/** Backfills the flag for a document that already holds a usable profile. */
export async function markProfileComplete(uid: string) {
  await setDoc(
    userRef(uid),
    { profileComplete: true, updatedAt: serverTimestamp() },
    { merge: true },
  );
  if (cached?.uid === uid && cached.profile) {
    remember(uid, { ...cached.profile, profileComplete: true });
  }
}
