import { useEffect, useState } from 'react';
import useAuthUser from './useAuthUser';
import { resolveAuthDestination } from '../services/profileGate';

/** The three places a launching app can legitimately land. */
export type AuthRoute = 'Onboarding' | 'CompleteProfile' | 'Home';

type Destination = {
  /** Null while it is still being worked out. */
  route: AuthRoute | null;
  resolving: boolean;
};

/**
 * Turns the Firebase session into a destination.
 *
 * Two asynchronous facts have to land before this can answer: whether there is
 * a persisted session (AsyncStorage) and whether that account finished its
 * profile (Firestore). Both are represented by `resolving`, so callers never
 * have to know there were two — and never route on a half-answer, which is how
 * a signed-in user ends up looking at Onboarding for a frame.
 *
 * Keyed on the UID, not the `User`: the auth listener emits a new object on
 * every token refresh, which would otherwise re-run the read.
 */
export default function useAuthDestination(): Destination {
  const { user, initializing } = useAuthUser();
  const uid = user?.uid ?? null;
  const [route, setRoute] = useState<AuthRoute | null>(null);

  useEffect(() => {
    if (initializing) return;

    if (!uid) {
      setRoute('Onboarding');
      return;
    }

    let active = true;
    setRoute(null);
    resolveAuthDestination(uid).then(destination => {
      if (active) setRoute(destination);
    });
    return () => {
      active = false;
    };
  }, [uid, initializing]);

  return { route, resolving: route === null };
}
