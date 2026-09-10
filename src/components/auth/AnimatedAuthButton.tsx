import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Check, X } from 'lucide-react-native';
import { AUTH_EASE } from './motion';
import { PILL_RADIUS } from './heroTokens';

export type AuthButtonState = 'idle' | 'loading' | 'success' | 'error';

export type AnimatedAuthButtonProps = {
  state: AuthButtonState;
  onPress: () => void;
  label: string;
  successLabel?: string;
  disabled?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  onErrorEnd?: () => void;
  testID?: string;
  accessibilityLabel?: string;
};

const BUTTON_HEIGHT = 56;
const BRAND_CYAN = '#06b6d4';

/**
 * Reusable animated authentication action button.
 *
 * Smoothly morphs the same physical button between:
 * - 'idle': Shows text label, accepts tap, smooth press scale.
 * - 'loading': Text fades out, centered spinner fades/scales in.
 * - 'success': Spinner morphs into checkmark + optional success text with spring.
 * - 'error': Morphs into X icon with subtle horizontal shake, then returns to idle.
 *
 * Honors reduced motion preferences and does NOT depend on Firebase.
 */
export default function AnimatedAuthButton({
  state,
  onPress,
  label,
  successLabel,
  disabled = false,
  radius = PILL_RADIUS,
  style,
  onErrorEnd,
  testID,
  accessibilityLabel,
}: AnimatedAuthButtonProps) {
  const reducedMotion = useReducedMotion();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const pressScale = useSharedValue(1);
  const shakeX = useSharedValue(0);

  const idleOpacity = useSharedValue(state === 'idle' ? 1 : 0);
  const idleScale = useSharedValue(state === 'idle' ? 1 : 0.9);

  const loadingOpacity = useSharedValue(state === 'loading' ? 1 : 0);
  const loadingScale = useSharedValue(state === 'loading' ? 1 : 0.7);

  const successOpacity = useSharedValue(state === 'success' ? 1 : 0);
  const successScale = useSharedValue(state === 'success' ? 1 : 0.6);

  const errorOpacity = useSharedValue(state === 'error' ? 1 : 0);
  const errorScale = useSharedValue(state === 'error' ? 1 : 0.6);

  useEffect(() => {
    if (reducedMotion) {
      // Reduced motion: direct opacity fades without scale, bounce, or shake
      const DURATION = 160;
      idleOpacity.value = withTiming(state === 'idle' ? 1 : 0, { duration: DURATION });
      loadingOpacity.value = withTiming(state === 'loading' ? 1 : 0, { duration: DURATION });
      successOpacity.value = withTiming(state === 'success' ? 1 : 0, { duration: DURATION });
      errorOpacity.value = withTiming(state === 'error' ? 1 : 0, { duration: DURATION });
      idleScale.value = 1;
      loadingScale.value = 1;
      successScale.value = 1;
      errorScale.value = 1;
      shakeX.value = 0;
      return;
    }

    if (state === 'idle') {
      idleOpacity.value = withTiming(1, { duration: 200, easing: AUTH_EASE });
      idleScale.value = withTiming(1, { duration: 200, easing: AUTH_EASE });

      loadingOpacity.value = withTiming(0, { duration: 140 });
      loadingScale.value = withTiming(0.7, { duration: 140 });

      successOpacity.value = withTiming(0, { duration: 140 });
      successScale.value = withTiming(0.6, { duration: 140 });

      errorOpacity.value = withTiming(0, { duration: 140 });
      errorScale.value = withTiming(0.6, { duration: 140 });
      shakeX.value = 0;
    } else if (state === 'loading') {
      idleOpacity.value = withTiming(0, { duration: 130 });
      idleScale.value = withTiming(0.9, { duration: 130 });

      loadingOpacity.value = withTiming(1, { duration: 180, easing: AUTH_EASE });
      loadingScale.value = withSpring(1, { damping: 14, stiffness: 220 });

      successOpacity.value = 0;
      successScale.value = 0.6;
      errorOpacity.value = 0;
      errorScale.value = 0.6;
      shakeX.value = 0;
    } else if (state === 'success') {
      loadingOpacity.value = withTiming(0, { duration: 100 });
      loadingScale.value = withTiming(0.5, { duration: 100 });

      idleOpacity.value = 0;
      errorOpacity.value = 0;

      successOpacity.value = withTiming(1, { duration: 200, easing: AUTH_EASE });
      successScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      shakeX.value = 0;
    } else if (state === 'error') {
      loadingOpacity.value = withTiming(0, { duration: 100 });
      loadingScale.value = withTiming(0.5, { duration: 100 });

      idleOpacity.value = 0;
      successOpacity.value = 0;

      errorOpacity.value = withTiming(1, { duration: 180, easing: AUTH_EASE });
      errorScale.value = withSpring(1, { damping: 14, stiffness: 220 });

      // 2–3 small horizontal shakes
      shakeX.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(-4, { duration: 50 }),
        withTiming(4, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [
    state,
    reducedMotion,
    idleOpacity,
    idleScale,
    loadingOpacity,
    loadingScale,
    successOpacity,
    successScale,
    errorOpacity,
    errorScale,
    shakeX,
  ]);

  // Handle error state timeout to cleanly return to idle
  useEffect(() => {
    if (state === 'error') {
      const timer = setTimeout(() => {
        if (mountedRef.current && onErrorEnd) {
          onErrorEnd();
        }
      }, 850);
      return () => clearTimeout(timer);
    }
  }, [state, onErrorEnd]);

  const blocked = disabled || state !== 'idle';

  const handlePressIn = () => {
    if (blocked) return;
    if (reducedMotion) {
      pressScale.value = 0.98;
    } else {
      pressScale.value = withTiming(0.97, {
        duration: 100,
        easing: Easing.out(Easing.quad),
      });
    }
  };

  const handlePressOut = () => {
    if (reducedMotion) {
      pressScale.value = 1;
    } else {
      pressScale.value = withSpring(1, { damping: 14, stiffness: 220 });
    }
  };

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: pressScale.value }],
  }));

  const idleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: idleOpacity.value,
    transform: [{ scale: idleScale.value }],
  }));

  const loadingAnimatedStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
    transform: [{ scale: loadingScale.value }],
  }));

  const successAnimatedStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ scale: successScale.value }],
  }));

  const errorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: errorOpacity.value,
    transform: [{ scale: errorScale.value }],
  }));

  const computedLabel =
    accessibilityLabel ||
    (state === 'loading'
      ? `${label}, loading`
      : state === 'success'
        ? successLabel || 'Success'
        : state === 'error'
          ? 'Error, please try again'
          : label);

  return (
    <Animated.View
      style={[
        styles.container,
        { borderRadius: radius },
        buttonAnimatedStyle,
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={blocked}
        accessibilityRole="button"
        accessibilityLabel={computedLabel}
        accessibilityState={{ disabled: blocked, busy: state === 'loading' }}
        testID={testID}
        style={[
          styles.pressable,
          {
            borderRadius: radius,
            opacity: disabled && state === 'idle' ? 0.5 : 1,
          },
        ]}
      >
        {/* Idle Layer */}
        <Animated.View
          style={[styles.centerLayer, idleAnimatedStyle]}
          pointerEvents={state === 'idle' ? 'auto' : 'none'}
        >
          <Text style={styles.btnText}>{label}</Text>
        </Animated.View>

        {/* Loading Layer */}
        <Animated.View
          style={[styles.centerLayer, loadingAnimatedStyle]}
          pointerEvents="none"
        >
          <ActivityIndicator size="small" color="#ffffff" />
        </Animated.View>

        {/* Success Layer */}
        <Animated.View
          style={[styles.centerLayer, successAnimatedStyle]}
          pointerEvents="none"
        >
          <View style={styles.successBadge}>
            <Check size={22} color="#ffffff" strokeWidth={2.8} />
          </View>
        </Animated.View>

        {/* Error Layer */}
        <Animated.View
          style={[styles.centerLayer, styles.row, errorAnimatedStyle]}
          pointerEvents="none"
        >
          <X size={20} color="#ffffff" strokeWidth={2.5} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: BUTTON_HEIGHT,
    width: '100%',
    backgroundColor: BRAND_CYAN,
    shadowColor: BRAND_CYAN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  pressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  centerLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  iconAdjacentText: {
    marginLeft: 8,
  },
  successBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
