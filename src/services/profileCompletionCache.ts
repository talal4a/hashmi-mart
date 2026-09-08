import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = '@hashmimart/profile-complete:';

const keyFor = (uid: string) => `${KEY_PREFIX}${uid}`;

/**
 * Stores only the fact that this device has previously verified a complete
 * profile. The UID-scoped marker lets the launch gate survive a temporary
 * Firestore timeout without persisting the user's profile details locally.
 */
export async function rememberProfileComplete(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(uid), 'true');
  } catch {
    // Firestore remains authoritative. A storage failure merely removes the
    // offline fast path and must never block a successful profile save.
  }
}

export async function wasProfileComplete(uid: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(keyFor(uid))) === 'true';
  } catch {
    return false;
  }
}

/** Clears a stale marker after Firestore successfully returns an incomplete profile. */
export async function forgetProfileComplete(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(uid));
  } catch {
    // A later successful read will try again; routing still follows Firestore now.
  }
}
