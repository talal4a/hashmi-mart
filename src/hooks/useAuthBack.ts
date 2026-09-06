import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

/** Clear auth history on Android native back, only while this form is focused.
 * iOS swipes pop to Onboarding: Login/Signup replace each other in the stack. */
export default function useAuthBack() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const goToOnboarding = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          goToOnboarding();
          return true;
        },
      );
      return () => subscription.remove();
    }, [goToOnboarding]),
  );

  return goToOnboarding;
}
