import { act, renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import useAuthBack from '../../src/hooks/useAuthBack';
import { createNavigation } from '../support/navigation';

describe('auth native back', () => {
  it.each(['Login', 'Signup'])('pops %s straight to onboarding after switching forms', initial => {
    const nav = createNavigation(initial);
    nav.navigation.replace(initial === 'Login' ? 'Signup' : 'Login');
    nav.navigation.replace(initial);
    nav.navigation.goBack();
    expect(nav.routes()).toEqual(['Onboarding']);
  });

  it.each(['Login', 'Signup'])('clears previous auth pages on Android back from %s', async initial => {
    const nav = createNavigation(initial);
    nav.navigation.navigate(initial === 'Login' ? 'Signup' : 'Login');
    const remove = jest.fn();
    const subscribe = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
    const { unmount } = await renderHook(() => useAuthBack(), { wrapper: nav.wrapper });
    const handler = subscribe.mock.calls.find(([event]) => event === 'hardwareBackPress')![1];
    await act(() => { expect(handler({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true); });
    expect(nav.routes()).toEqual(['Onboarding']);
    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});
