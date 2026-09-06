import type { User } from 'firebase/auth';

export const account = {
  uid: 'test-user',
  displayName: 'Test User',
  email: 'test@example.com',
  photoURL: null,
} as User;

export const completeProfile = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '+923001234567',
  role: 'customer',
  profileComplete: true,
};

export const documents = new Map<string, Record<string, unknown>>();
export const auth = { currentUser: null as User | null };
export const db = {};
export const listeners = new Set<(user: User | null) => void>();

export function emitAuth(user: User | null) {
  auth.currentUser = user;
  listeners.forEach(listener => listener(user));
}

export const firestoreSdk = {
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(),
};

export const authSdk = {
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  updateProfile: jest.fn(),
  signInWithCredential: jest.fn(),
  signOut: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  onAuthStateChanged: jest.fn(),
  GoogleAuthProvider: { credential: jest.fn() },
};

export const googleSdk = {
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signInSilently: jest.fn(),
    signOut: jest.fn(),
    revokeAccess: jest.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: '12501',
    IN_PROGRESS: '12502',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
};

/** Fresh SDK boundaries per test; the app's services and profile gate stay real. */
export function resetFirebase() {
  documents.clear();
  listeners.clear();
  auth.currentUser = null;
  for (const mock of [
    ...Object.values(firestoreSdk),
    ...Object.values(authSdk).filter(value => typeof value === 'function'),
    authSdk.GoogleAuthProvider.credential,
    ...Object.values(googleSdk.GoogleSignin),
  ]) (mock as jest.Mock).mockReset();

  firestoreSdk.doc.mockImplementation((_db, collection, uid) => `${collection}/${uid}`);
  firestoreSdk.serverTimestamp.mockReturnValue('server-timestamp');
  firestoreSdk.getDoc.mockImplementation(async ref => {
    const data = documents.get(ref);
    return { exists: () => !!data, data: () => data, get: (key: string) => data?.[key] };
  });
  firestoreSdk.setDoc.mockImplementation(async (ref, data, options) => {
    documents.set(ref, { ...(options?.merge ? documents.get(ref) : {}), ...data });
  });
  for (const method of ['createUserWithEmailAndPassword', 'signInWithEmailAndPassword', 'signInWithCredential'] as const) {
    authSdk[method].mockImplementation(async () => {
      const user = { ...account };
      emitAuth(user);
      return { user };
    });
  }
  authSdk.updateProfile.mockImplementation(async (user, details) => Object.assign(user, details));
  authSdk.signOut.mockImplementation(async () => emitAuth(null));
  authSdk.sendPasswordResetEmail.mockResolvedValue(undefined);
  authSdk.GoogleAuthProvider.credential.mockImplementation(idToken => ({ idToken }));
  authSdk.onAuthStateChanged.mockImplementation((_auth, callback) => {
    listeners.add(callback);
    callback(auth.currentUser);
    return () => listeners.delete(callback);
  });
  googleSdk.GoogleSignin.hasPlayServices.mockResolvedValue(true);
  googleSdk.GoogleSignin.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'test-token' } });
  googleSdk.GoogleSignin.signInSilently.mockResolvedValue({ type: 'noSavedCredentialFound' });
  googleSdk.GoogleSignin.signOut.mockResolvedValue(undefined);
  googleSdk.GoogleSignin.revokeAccess.mockResolvedValue(undefined);
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
