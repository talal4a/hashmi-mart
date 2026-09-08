import { renderHook, waitFor } from '@testing-library/react-native';
import useStoredProfile from '../../src/hooks/useStoredProfile';
import {
  account,
  completeProfile,
  documents,
  emitAuth,
} from '../support/firebase';
import { createNavigation } from '../support/navigation';

test('loading a completed identity does not dismiss the Support screen', async () => {
  documents.set(`users/${account.uid}`, completeProfile);
  emitAuth(account);
  const nav = createNavigation('Support');

  const { result } = await renderHook(
    () => useStoredProfile({ redirectCompletedProfile: false }),
    { wrapper: nav.wrapper },
  );

  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.profile?.name).toBe(completeProfile.name);
  expect(nav.current()).toBe('Support');
  expect(nav.navigation.reset).not.toHaveBeenCalled();
});
