import React, { useCallback, useRef } from 'react';
import { StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import AuthBottomSheet from '../components/AuthBottomSheet';
import type { AuthBottomSheetHandle } from '../components/AuthBottomSheet';
import OnboardingCopy from '../components/onboarding/OnboardingCopy';
import StartButton from '../components/onboarding/StartButton';
import MartBackdrop from '../components/onboarding/scene/MartBackdrop';
import MartScene from '../components/onboarding/scene/MartScene';
import { layout } from '../components/onboarding/scene/geometry';
import { useSceneReady } from '../components/onboarding/scene/useSceneReady';
import { useSceneTimeline } from '../components/onboarding/scene/useSceneTimeline';
import { SPLASH_BG } from '../components/splash/tokens';
import { ONBOARDING_COPY } from '../data/onboardingSlides';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Launch screen: the mart scene, the copy, and one way in.
 *
 * Pure composition — every piece comes from components/onboarding. The screen
 * owns three things only: the window metrics the scene square is fitted into,
 * the timeline (armed by the artwork once it has settled), and the auth sheet
 * the Start pill opens. Google sign-in runs inside the sheet; email and sign-in
 * hand off to their screens so the forms stay where the back gesture expects
 * them. "Continue with Phone" is displayed for parity but has no flow behind it
 * yet, so it is left unwired rather than pretending.
 */
export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheet = useRef<AuthBottomSheetHandle>(null);

  const armed = useSceneReady();
  const beats = useSceneTimeline(armed);
  const l = layout(width, height * SLOT_FRACTION);

  const openSheet = useCallback(() => {
    sheet.current?.snapToIndex(0);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={SPLASH_BG} />

      <MartBackdrop
        layout={l}
        width={width}
        height={height}
        progress={beats.room}
      />
      <View style={[styles.slot, { width, height: height * SLOT_FRACTION }]}>
        <MartScene beats={beats} layout={l} />
      </View>

      <View style={[styles.footer, { bottom: insets.bottom + 24 }]}>
        <OnboardingCopy
          title={ONBOARDING_COPY.title}
          subtitle={ONBOARDING_COPY.subtitle}
          titleProgress={beats.title}
          subtitleProgress={beats.subtitle}
        />
        <StartButton progress={beats.button} onPress={openSheet} />
      </View>

      <AuthBottomSheet
        ref={sheet}
        onManualSignUpPress={() => navigation.navigate('Signup')}
        onSignInPress={() => navigation.navigate('Login')}
      />
    </View>
  );
}

/**
 * How much of the screen the scene square lives in. The illustration is square
 * and the slot is not, so the square centres inside this band and the copy sits
 * in what is left below it.
 */
const SLOT_FRACTION = 0.68;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SPLASH_BG },
  slot: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  footer: {
    position: 'absolute',
    left: 24,
    right: 24,
    gap: 32,
  },
});
