import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  peekUserDocument,
  readUserDocument,
  type UserDocument,
} from '../services/users';
import useAuthUser from './useAuthUser';

/**
 * Who the user is, for screens that only want to *show* them.
 *
 * `useStoredProfile` looks like the hook for this and is not: it is Complete
 * Profile's gate, and it navigates. A complete profile makes it call
 * `navigation.reset` to Home, and no session at all sends you to Onboarding —
 * correct for the screen it was written for, and ruinous anywhere else. Support
 * used it for a name and an avatar and was bounced back to Home the instant it
 * mounted, which looks exactly like a screen that failed to open.
 *
 * So this reads the same document and does nothing else. No redirects, no
 * completion checks, no opinion about where the user should be.
 *
 * The cache is consulted first because every route into the app has just read
 * `users/{uid}`; the network read is the cold path, and its failure is silently
 * survivable — a chat that shows initials instead of a photo is fine, while a
 * chat that refuses to open because a profile read timed out is not.
 */
export type ProfileIdentity = {
  user: User | null;
  profile: UserDocument | null;
};

export default function useProfileIdentity(): ProfileIdentity {
  const { user } = useAuthUser();
  const uid = user?.uid ?? null;

  // Seeded from the cache during render rather than in the effect below, so the
  // first frame already has a name. Effects run after paint, and the visible
  // cost of waiting for one here is the greeting saying "there" and then
  // flicking to the user's real name.
  const [profile, setProfile] = useState<UserDocument | null>(
    () => (uid ? (peekUserDocument(uid)?.profile ?? null) : null),
  );

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }

    const cached = peekUserDocument(uid);
    if (cached) {
      setProfile(cached.profile);
      return;
    }

    let active = true;
    readUserDocument(uid)
      .then(fresh => {
        if (active) setProfile(fresh);
      })
      .catch(() => {
        // Falls back to whatever Firebase Auth knows — a display name and a
        // photo URL are enough to render an identity.
      });

    return () => {
      active = false;
    };
  }, [uid]);

  return { user, profile };
}
