import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  resolveAuthDestination,
  type AuthDestination,
} from '../services/profileGate';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Leaving an auth screen once the session exists.
 *
 * `reset` rather than `navigate`, always: auth screens are terminal, and a
 * signed-in user pressing hardware back onto a login form is the bug this
 * prevents.
 *
 * `goByProfile` is the one every sign-in path should use — it asks the gate,
 * so no screen has to hold an opinion about what "complete" means. `goTo` is
 * for the one case that already knows the answer: an account created seconds
 * ago has nothing to look up, and skipping the read there saves a round-trip
 * on the slowest path in the app.
 */
export default function useAfterAuth() {
  const navigation = useNavigation<Nav>();

  const goTo = useCallback(
    (route: AuthDestination) => {
      navigation.reset({ index: 0, routes: [{ name: route }] });
    },
    [navigation],
  );

  const goByProfile = useCallback(
    async (uid: string) => {
      goTo(await resolveAuthDestination(uid));
    },
    [goTo],
  );

  return { goTo, goByProfile };
}
