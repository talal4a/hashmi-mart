import React, { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { CARD_LIFT, HERO_TOP } from './heroTokens';

/** The pale cyan every auth screen sits on, and the navigator's own
 *  `contentStyle`, so a screen transition never flashes white. */
export const AUTH_BG = '#ecfeff';

/**
 * Page chrome for the auth screens: safe-area padding, the keyboard behaviour,
 * a scroll container that still lets taps through to buttons, and an optional
 * back chip.
 *
 * Each screen had its own copy of this, which is how they ended up disagreeing
 * about `keyboardShouldPersistTaps` — without it the first tap on a button only
 * dismisses the keyboard, so submitting a form takes two taps and looks broken.
 *
 * `flexGrow: 1` rather than `flex: 1` on the content: the card must be able to
 * grow past the viewport and scroll once the keyboard is up on a short screen,
 * which is the case that makes a profile form unusable if you get it wrong.
 *
 * `hero` switches the page into the banded layout Login and Sign Up use. It
 * changes three things and nothing else: the safe-area and horizontal padding
 * move off the scroll content (a band cannot be full-bleed through 24dp of
 * padding) and onto the band and an inner wrapper, the card is pulled up into
 * the band by `CARD_LIFT`, and the status bar goes light because it is now
 * sitting inside dark artwork. Screens without a hero take the original path
 * untouched.
 */
export default function AuthScreen({
  children,
  onBack,
  hero,
}: {
  children: ReactNode;
  onBack?: () => void;
  hero?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  const back = onBack ? (
    <Pressable
      onPress={onBack}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      className="mb-4 h-10 w-10 items-center justify-center rounded-full bg-white"
    >
      <ArrowLeft size={20} color="#0B2027" />
    </Pressable>
  ) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      // Android: the manifest already sets adjustResize, and stacking the JS
      // height adjustment on top of it has been observed to deadlock the JS
      // thread on Fabric during keyboard show/hide (blank screen, no error).
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar
        barStyle={hero ? 'light-content' : 'dark-content'}
        backgroundColor={hero ? HERO_TOP : AUTH_BG}
      />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: hero ? 0 : insets.top + 20,
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: hero ? 0 : 24,
          backgroundColor: AUTH_BG,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {hero ? (
          <>
            {hero}
            <View
              style={{
                paddingHorizontal: 20,
                marginTop: -CARD_LIFT,
                backgroundColor: AUTH_BG,
              }}
            >
              {back}
              {children}
            </View>
          </>
        ) : (
          <>
            {back}
            {children}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
