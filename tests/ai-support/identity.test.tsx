import { renderHook, waitFor } from '@testing-library/react-native';
import useProfileIdentity from '../../src/hooks/useProfileIdentity';
import useStoredProfile from '../../src/hooks/useStoredProfile';
import { account, completeProfile, documents, emitAuth } from '../support/firebase';
import { createNavigation } from '../support/navigation';

/**
 * Why Support does not use `useStoredProfile`.
 *
 * It reads like the hook for "give me the signed-in user's name and avatar",
 * and it is not: it is Complete Profile's gate, and it *navigates*. A finished
 * profile makes it reset the stack to Home. Support used it for an avatar and
 * was thrown back to Home the moment it mounted — which on a phone looks
 * exactly like a screen that failed to open, with no error anywhere.
 *
 * The second test below pins that behaviour deliberately rather than treating
 * it as a bug: Complete Profile needs it. What must not happen is another
 * screen reaching for the same hook because of its name. Keeping both
 * assertions side by side is what makes the difference visible to whoever
 * looks next.
 */

function signedInWithCompleteProfile() {
  documents.set(`users/${account.uid}`, { ...completeProfile, name: 'Talal Ahmed' });
  emitAuth(account);
}

describe('useProfileIdentity', () => {
  it('never navigates, whatever the profile says', async () => {
    signedInWithCompleteProfile();
    const nav = createNavigation('Home');

    const { result } = await renderHook(() => useProfileIdentity(), {
      wrapper: nav.wrapper,
    });

    // The whole point of the hook. A redirect here is Support failing to open.
    expect(nav.navigation.reset).not.toHaveBeenCalled();
    expect(nav.navigation.navigate).not.toHaveBeenCalled();
    expect(nav.navigation.replace).not.toHaveBeenCalled();
    expect(result.current.user?.uid).toBe(account.uid);
  });

  it('still returns nothing to navigate about when signed out', async () => {
    emitAuth(null);
    const nav = createNavigation('Home');

    const { result } = await renderHook(() => useProfileIdentity(), {
      wrapper: nav.wrapper,
    });

    // Signed out sends `useStoredProfile` to Onboarding. Support must simply
    // render without an identity instead — the backend rejects the call and the
    // chat shows "please sign in", which is a better answer than a stack reset.
    expect(nav.navigation.reset).not.toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('surfaces the stored name so the greeting is not a placeholder', async () => {
    signedInWithCompleteProfile();
    const nav = createNavigation('Home');

    const { result } = await renderHook(() => useProfileIdentity(), {
      wrapper: nav.wrapper,
    });

    await waitFor(() => expect(result.current.profile?.name).toBe('Talal Ahmed'));
  });
});

describe('useStoredProfile, for contrast', () => {
  it('resets to Home on a complete profile — which is why Support cannot use it', async () => {
    signedInWithCompleteProfile();
    const nav = createNavigation('Home');

    await renderHook(() => useStoredProfile(), { wrapper: nav.wrapper });

    await waitFor(() =>
      expect(nav.navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Home' }],
      }),
    );
  });
});
