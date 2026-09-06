import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { User } from 'firebase/auth';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  peekUserDocument,
  readUserDocument,
  type UserDocument,
} from '../services/users';
import { isProfileComplete } from '../services/profileGate';
import useAuthUser from './useAuthUser';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** 'leaving' means a reset is already in flight; draw nothing. */
type Status = 'loading' | 'ready' | 'leaving';

export type StoredProfile = {
  status: Status;
  user: User | null;
  profile: UserDocument | null;
  /** The read failed: the form is running on the auth account alone. */
  offline: boolean;
};

/**
 * What Complete Profile knows before it draws anything.
 *
 * Three answers have to arrive first, and all three change what the screen is:
 * whether there is a session at all, what `users/{uid}` already holds, and
 * whether that document is in fact finished.
 *
 * The last one is not paranoia. `resolveAuthDestination` deliberately routes a
 * failed read here rather than into the app, so an already-complete user who
 * opens the app on a dead connection lands on this screen. Re-reading and
 * forwarding silently is what turns that safety choice into something the user
 * never notices — without it, the price of the rule would be paid by exactly the
 * people who had already filled the form in.
 *
 * Prefilling matters for the same reason: a Google account arrives with a name
 * already stored, and a user who half-filled this form and backed out should not
 * find it blank. The form is mounted only once this resolves, so react-hook-form
 * gets real `defaultValues` instead of a `reset()` racing the first keystroke.
 *
 * No session at all means somebody reached this route without one — a logout
 * from a stale screen, or a hand-written deep link. That resets to Onboarding
 * rather than rendering a form whose submit has no UID to write to.
 *
 * None of that needs to be *waited* for in the ordinary case. Every route into
 * this screen has just read `users/{uid}` — the sign-in seed, then the gate — so
 * the answer is already in `services/users`' cache and the form can mount fully
 * formed on the first frame. The read below is the cold path: a cache too old to
 * trust, or a launch that landed here directly. That is the difference between a
 * screen that appears and a screen that appears as a spinner and then jumps.
 */
export default function useStoredProfile(): StoredProfile {
  const { user, initializing } = useAuthUser();
  const navigation = useNavigation<Nav>();
  const uid = user?.uid ?? null;

  const [state, setState] = useState<{
    status: Status;
    profile: UserDocument | null;
    offline: boolean;
  }>({ status: 'loading', profile: null, offline: false });

  // Derived during render rather than seeded in the effect below, because effects
  // run after the first paint: seeding there would still cost one frame of empty
  // screen followed by a jump to the full form, which is the thing being fixed.
  // A cached document that is already complete is not seeded — that user is on
  // their way to Home and should not be shown a form on the way past.
  const cached =
    uid && state.status === 'loading' ? peekUserDocument(uid) : null;
  const seed =
    cached && !(cached.profile && isProfileComplete(cached.profile))
      ? cached
      : null;

  useEffect(() => {
    if (initializing) return;

    if (!uid) {
      setState({ status: 'leaving', profile: null, offline: false });
      navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
      return;
    }

    const known = peekUserDocument(uid);
    if (known) {
      if (known.profile && isProfileComplete(known.profile)) {
        setState({ status: 'leaving', profile: known.profile, offline: false });
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        return;
      }
      setState({ status: 'ready', profile: known.profile, offline: false });
      return;
    }

    let active = true;
    setState({ status: 'loading', profile: null, offline: false });

    readUserDocument(uid)
      .then(profile => {
        if (!active) return;

        if (profile && isProfileComplete(profile)) {
          // Reached only when the gate's own read failed. The flag is left for
          // resolveAuthDestination to backfill on the next launch: it already
          // does that, and a write here would be a second chance to fail on a
          // connection that has just proved unreliable.
          setState({ status: 'leaving', profile, offline: false });
          navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
          return;
        }

        setState({ status: 'ready', profile, offline: false });
      })
      .catch(error => {
        console.warn('Could not read users/{uid} for Complete Profile:', error);
        if (active) setState({ status: 'ready', profile: null, offline: true });
      });

    return () => {
      active = false;
    };
  }, [uid, initializing, navigation]);

  if (seed) {
    return { status: 'ready', profile: seed.profile, offline: false, user };
  }
  return { ...state, user };
}
