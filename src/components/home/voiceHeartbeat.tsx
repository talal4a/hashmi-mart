import { useEffect } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { grocery } from './groceryTheme';

const CYCLE_MS = 5000;

/** Smooth, bounded beat envelope. Every element reads the same UI-thread clock. */
function beat(phase: number, start: number, end: number) {
  'worklet';
  if (phase <= start || phase >= end) return 0;
  const wave = Math.sin(((phase - start) / (end - start)) * Math.PI);
  return wave * wave;
}

export function useVoiceHeartbeat() {
  const phase = useSharedValue(0);
  const focused = useIsFocused();
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const update = (state: string) => {
      cancelAnimation(phase);
      phase.value = 0;
      if (focused && !reducedMotion && state === 'active') {
        phase.value = withRepeat(
          withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }),
          -1,
          false,
        );
      }
    };
    update(AppState.currentState);
    const subscription = AppState.addEventListener('change', update);
    return () => {
      subscription.remove();
      cancelAnimation(phase);
      phase.value = 0;
    };
  }, [focused, reducedMotion, phase]);
  const micStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale:
          1 +
          0.03 * beat(phase.value, 0.16, 0.28) +
          0.06 * beat(phase.value, 0.32, 0.48),
      },
    ],
  }));
  return { phase, micStyle };
}

export function HeartbeatBar({
  phase,
  index,
  count,
  height,
  color = grocery.blue,
}: {
  phase: SharedValue<number>;
  index: number;
  count: number;
  height: number;
  color?: string;
}) {
  const style = useAnimatedStyle(() => {
    // A continuous ripple travelling outward from the mic on both sides,
    // plus the heartbeat accent. Two wave loops per cycle wrap seamlessly.
    const distance =
      Math.abs(index - (count - 1) / 2) / Math.max(1, (count - 1) / 2);
    const ripple = Math.max(
      0,
      Math.sin((phase.value * 2 - distance) * 2 * Math.PI),
    );
    const strong = beat(phase.value - distance * 0.018, 0.32, 0.48);
    return {
      transform: [
        { scaleY: 1 + (0.5 * ripple + 0.3 * strong) * (1 - distance * 0.35) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { width: 2, height, borderRadius: 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

export function HeartbeatRing({
  phase,
  delay = 0,
}: {
  phase: SharedValue<number>;
  delay?: number;
}) {
  const style = useAnimatedStyle(() => {
    const progress = (phase.value - 0.36 - delay) / 0.2;
    const clamped = Math.max(0, Math.min(1, progress));
    return {
      opacity:
        progress > 0 && progress < 1 ? Math.sin(Math.PI * clamped) * 0.22 : 0,
      transform: [{ scale: 1 + clamped * 0.55 }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      style={[s.ring, style]}
    />
  );
}
const s = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 35,
    borderWidth: 1.5,
    borderColor: grocery.blue,
    backgroundColor: '#0EA5E910',
  },
});
