import React, { type PropsWithChildren } from 'react';
import { NavigationContext } from '@react-navigation/native';
import type {
  ParamListBase,
  StackNavigationState,
} from '@react-navigation/native';
import { CommonActions, StackActions, StackRouter } from '@react-navigation/routers';

/** Real stack transitions, with a small event surface for the navigation hooks. */
export function createNavigation(initialRoute = 'Login') {
  const router = StackRouter({ initialRouteName: 'Onboarding' });
  const options = {
    routeNames: ['Onboarding', 'Login', 'Signup', 'ForgotPassword', 'CompleteProfile', 'Home'],
    routeParamList: {},
    routeGetIdList: {},
  };
  let state = router.getInitialState(options);
  const dispatch = (action: Parameters<typeof router.getStateForAction>[1]) => {
    const next = router.getStateForAction(state, action, options);
    if (!next) throw new Error(`Unhandled navigation action: ${action.type}`);
    // getStateForAction may hand back a partial state; the router's own
    // container merges it onto the current one the same way.
    state =
      'key' in next && 'index' in next
        ? (next as StackNavigationState<ParamListBase>)
        : ({ ...state, ...next } as StackNavigationState<ParamListBase>);
  };
  if (initialRoute !== 'Onboarding') dispatch(CommonActions.navigate(initialRoute));
  let focused = true;
  const listeners = new Map<string, Set<() => void>>();
  const navigation = {
    reset: jest.fn((next: { index: number; routes: { name: string }[] }) => dispatch(CommonActions.reset(next))),
    navigate: jest.fn((name: string) => dispatch(CommonActions.navigate(name))),
    replace: jest.fn((name: string) => dispatch(StackActions.replace(name))),
    popTo: jest.fn((name: string) => dispatch(StackActions.popTo(name))),
    goBack: jest.fn(() => dispatch(CommonActions.goBack())),
    isFocused: () => focused,
    addListener: (event: string, listener: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return () => listeners.get(event)!.delete(listener);
    },
  };
  return {
    navigation,
    routes: () => state.routes.map(route => route.name),
    current: () => state.routes[state.index].name,
    focus(value: boolean) {
      focused = value;
      listeners.get(value ? 'focus' : 'blur')?.forEach(listener => listener());
    },
    wrapper({ children }: PropsWithChildren) {
      return <NavigationContext.Provider value={navigation as never}>{children}</NavigationContext.Provider>;
    },
  };
}
