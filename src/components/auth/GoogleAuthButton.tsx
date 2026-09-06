import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import GoogleGlyph from './GoogleGlyph';

/** 60dp against ThemedButton's 56 — the brief asks for the largest target on
 *  the screen, and this is the only control most users will use. */
const HEIGHT = 60;

type Props = {
  onPress: () => void;
  loading?: boolean;
  /** Set while another submission is in flight, so the two can't overlap. */
  disabled?: boolean;
  label?: string;
  style?: ViewStyle;
};

/**
 * The Google sign-in button, and the most prominent control on the auth
 * screens.
 *
 * Kept apart from ThemedButton's `google` variant rather than added to it: this
 * needs a spinner slot, a busy accessibility state and its own height, and
 * threading all of that through the generic button would push its own callers'
 * concerns onto every other button in the app.
 *
 * The glyph sits in a fixed-width slot so swapping it for the spinner cannot
 * shift the label sideways — a 1px twitch at the moment of tapping reads as a
 * mis-tap. The label carries the whole state change instead.
 *
 * White surface with a hairline border is Google's own requirement for a light
 * background; prominence therefore comes from height, a lifted shadow and full
 * width rather than from tinting the surface with the brand cyan.
 *
 * Uses RN's built-in Animated rather than Reanimated, which is the same move
 * already made for AuthCard, AuthHero, AvatarChip and the rest of the auth
 * furniture, and for the same reason. This is the last control the user touches
 * before `navigation.reset()` destroys Login or Signup, and the press-out spring
 * outlives the release by ~160ms — a cached Google credential can resolve inside
 * that. A Reanimated value still moving when Fabric deletes its view is what
 * produces `Unable to find SurfaceMountingManager for tag: [n]`; RN's native
 * driver is torn down with the view, so there is no window. Numbers below are the
 * Reanimated ones unchanged, so the feel is identical.
 */
export default function GoogleAuthButton({
  onPress,
  loading = false,
  disabled = false,
  label = 'Continue with Google',
  style,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const blocked = loading || disabled;

  useEffect(() => {
    return () => {
      scale.stopAnimation();
    };
  }, []);

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 110,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      damping: 14,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={blocked ? undefined : handlePressIn}
        onPressOut={blocked ? undefined : handlePressOut}
        disabled={blocked}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: blocked, busy: loading }}
        style={{
          height: HEIGHT,
          backgroundColor: '#ffffff',
          borderWidth: 1,
          borderColor: '#e5e7eb',
          shadowColor: '#0B2027',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
          opacity: disabled && !loading ? 0.5 : 1,
        }}
        className="w-full flex-row items-center justify-center rounded-2xl"
      >
        <View style={{ width: 24, alignItems: 'center', marginRight: 12 }}>
          {loading ? (
            <ActivityIndicator size="small" color="#06b6d4" />
          ) : (
            <GoogleGlyph size={24} />
          )}
        </View>
        <Text className="text-[16px] font-semibold text-[#0B2027]">
          {loading ? 'Signing in…' : label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
