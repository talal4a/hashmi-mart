import { createAccount, signIn } from '../../src/services/emailAuth';
import {
  configureGoogleSignIn,
  isGoogleSignedIn,
  signInWithGoogle,
  signOutGoogle,
  revokeGoogleAccess,
} from '../../src/services/googleAuth';
import { peekUserDocument, readUserDocument } from '../../src/services/users';
import { resolveAuthDestination } from '../../src/services/profileGate';
import { account, auth, authSdk, completeProfile, deferred, documents, firestoreSdk, googleSdk } from '../support/firebase';

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));

describe('email authentication', () => {
  test('signup normalizes identity and creates one incomplete profile with no role', async () => {
    const credential = await createAccount('  New User  ', ' new@example.com ', 'password123');
    expect(authSdk.createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'new@example.com', 'password123');
    expect(credential.user.displayName).toBe('New User');
    expect(documents.size).toBe(1);
    expect(documents.get(`users/${account.uid}`)).toMatchObject({ name: 'New User', role: null, profileComplete: false, provider: 'password' });
    expect(await resolveAuthDestination(account.uid)).toBe('CompleteProfile');
  });

  test('signup retains the typed name when the Auth display-name update fails', async () => {
    authSdk.createUserWithEmailAndPassword.mockResolvedValue({ user: { ...account, displayName: null } });
    authSdk.updateProfile.mockRejectedValue(new Error('Offline'));
    await createAccount('  New User  ', account.email!, 'password123');
    expect(documents.get(`users/${account.uid}`)?.name).toBe('New User');
  });

  test.each(['signup', 'login'])('%s can recover when profile seeding fails after authentication', async intent => {
    firestoreSdk.setDoc.mockRejectedValue(new Error('Offline'));
    const credential = intent === 'signup'
      ? await createAccount('Test User', account.email!, 'password123')
      : await signIn(account.email!, 'password123');
    expect(credential.user.uid).toBe(account.uid);
    expect(await resolveAuthDestination(account.uid)).toBe('CompleteProfile');
  });

  test.each(['signup', 'login'])('%s propagates credential failures without writing a profile', async intent => {
    const error = { code: intent === 'signup' ? 'auth/email-already-in-use' : 'auth/invalid-credential' };
    authSdk.createUserWithEmailAndPassword.mockRejectedValue(error);
    authSdk.signInWithEmailAndPassword.mockRejectedValue(error);
    await expect(intent === 'signup'
      ? createAccount('Test User', account.email!, 'password123')
      : signIn(account.email!, 'password123')).rejects.toEqual(error);
    expect(firestoreSdk.setDoc).not.toHaveBeenCalled();
  });

  test('login trims email and preserves all user-edited profile fields', async () => {
    const stored = { ...completeProfile, role: 'vendor', name: 'Shop Owner', address: 'Market Road', gender: 'female', avatarId: 'chosen', avatarUrl: 'https://example.com/photo.png', avatarPublicId: 'photo-id' };
    documents.set(`users/${account.uid}`, stored);
    await signIn(' test@example.com ', 'secret');
    expect(authSdk.signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'test@example.com', 'secret');
    expect(documents.get(`users/${account.uid}`)).toMatchObject(stored);
    expect(await resolveAuthDestination(account.uid)).toBe('Home');
  });
});

describe('Google authentication', () => {
  test('configures Google with a web client ID', () => {
    configureGoogleSignIn();
    expect(googleSdk.GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: expect.stringMatching(/\.apps\.googleusercontent\.com$/), offlineAccess: true });
  });

  test.each([
    { type: 'success', data: { idToken: 'test-token' } },
    { idToken: 'test-token' },
  ])('exchanges a supported Google response for Firebase credentials', async response => {
    googleSdk.GoogleSignin.signIn.mockResolvedValue(response);
    const result = await signInWithGoogle();
    expect(result?.user.uid).toBe(account.uid);
    expect(authSdk.GoogleAuthProvider.credential).toHaveBeenCalledWith('test-token');
    expect(authSdk.signInWithCredential).toHaveBeenCalledWith(auth, { idToken: 'test-token' });
    expect(documents.get(`users/${account.uid}`)).toMatchObject({ provider: 'google', role: null, profileComplete: false });
  });

  test.each(['response', 'string-code', 'numeric-code'])('Google cancellation (%s) creates no Firebase session or profile', async variant => {
    if (variant === 'response') googleSdk.GoogleSignin.signIn.mockResolvedValue({ type: 'cancelled', data: null });
    else googleSdk.GoogleSignin.signIn.mockRejectedValue({ code: variant === 'string-code' ? '12501' : 12501 });
    expect(await signInWithGoogle()).toBeNull();
    expect(authSdk.signInWithCredential).not.toHaveBeenCalled();
    expect(firestoreSdk.setDoc).not.toHaveBeenCalled();
  });

  test.each([null, {}, { type: 'success', data: {} }])('rejects a missing token without opening a Firebase session', async response => {
    googleSdk.GoogleSignin.signIn.mockResolvedValue(response);
    await expect(signInWithGoogle()).rejects.toThrow('ID token');
    expect(authSdk.signInWithCredential).not.toHaveBeenCalled();
  });

  test('Play Services failure does not start sign-in', async () => {
    googleSdk.GoogleSignin.hasPlayServices.mockRejectedValue({ code: 'PLAY_SERVICES_NOT_AVAILABLE' });
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'PLAY_SERVICES_NOT_AVAILABLE' });
    expect(googleSdk.GoogleSignin.signIn).not.toHaveBeenCalled();
  });

  test('Google and Firebase failures propagate to the screen', async () => {
    googleSdk.GoogleSignin.signIn.mockRejectedValueOnce({ code: '10' });
    await expect(signInWithGoogle()).rejects.toEqual({ code: '10' });
    authSdk.signInWithCredential.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    await expect(signInWithGoogle()).rejects.toEqual({ code: 'auth/network-request-failed' });
    expect(firestoreSdk.setDoc).not.toHaveBeenCalled();
  });

  test('profile write failure after Google auth is recoverable', async () => {
    firestoreSdk.setDoc.mockRejectedValue(new Error('Offline'));
    expect((await signInWithGoogle())?.user.uid).toBe(account.uid);
    expect(await resolveAuthDestination(account.uid)).toBe('CompleteProfile');
  });

  test.each([
    [{ type: 'success', data: { idToken: 'token' } }, true],
    [{ idToken: 'token' }, true],
    [{ type: 'noSavedCredentialFound' }, false],
    [{}, false],
  ])('silent restoration handles %j', async (response, expected) => {
    googleSdk.GoogleSignin.signInSilently.mockResolvedValue(response);
    expect(await isGoogleSignedIn()).toBe(expected);
  });

  test('silent restoration failure is a signed-out result', async () => {
    googleSdk.GoogleSignin.signInSilently.mockRejectedValue(new Error('No session'));
    expect(await isGoogleSignedIn()).toBe(false);
  });
});

describe('sign-out', () => {
  test('clears the profile cache immediately and signs out Firebase while Google is pending', async () => {
    documents.set(`users/${account.uid}`, completeProfile);
    await readUserDocument(account.uid);
    const pending = deferred<void>();
    googleSdk.GoogleSignin.signOut.mockReturnValue(pending.promise);
    const result = signOutGoogle();
    expect(peekUserDocument(account.uid)).toBeNull();
    expect(authSdk.signOut).toHaveBeenCalledWith(auth);
    pending.resolve();
    await result;
  });

  test('a missing Google session does not prevent Firebase sign-out', async () => {
    googleSdk.GoogleSignin.signOut.mockRejectedValue(new Error('No Google account'));
    await expect(signOutGoogle()).resolves.toBeUndefined();
    expect(authSdk.signOut).toHaveBeenCalled();
  });

  test('a Firebase sign-out failure remains visible to the caller', async () => {
    authSdk.signOut.mockRejectedValue(new Error('Sign-out failed'));
    await expect(signOutGoogle()).rejects.toThrow('Sign-out failed');
  });

  test.each([false, true])('revocation always signs out (revocation fails: %s)', async fails => {
    if (fails) googleSdk.GoogleSignin.revokeAccess.mockRejectedValue(new Error('No grant'));
    await revokeGoogleAccess();
    expect(googleSdk.GoogleSignin.revokeAccess).toHaveBeenCalled();
    expect(authSdk.signOut).toHaveBeenCalled();
  });
});
