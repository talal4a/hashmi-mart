import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../config/firebase';
type AuthState = {
  user: User | null;
  /** True until Firebase has read the persisted session for the first time. */
  initializing: boolean;
};
/**
 * Subscribes to the Firebase session. `initializing` is the important bit:
 * on a cold start the persisted user arrives asynchronously from AsyncStorage,
 * so `user === null` is not yet meaningful until it flips to false.
 */
export default function useAuthUser(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: auth.currentUser,
    initializing: true,
  });

  useEffect(
    () =>
      onAuthStateChanged(auth, user => setState({ user, initializing: false })),
    [],
  );

  return state;
}
