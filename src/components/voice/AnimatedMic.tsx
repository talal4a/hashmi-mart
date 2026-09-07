import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Mic } from 'lucide-react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { grocery } from '../home/groceryTheme';

/**
 * The microphone button, in both of its states, for Voice Order and AI Support.
 *
 * Idle it is a flat control. Recording it breathes — a slow scale, not a bounce
 * — because PRD section 9.1 asks for "a subtle pulse" and section 15 asks for
 * restraint, and the difference between those two readings is entirely in the
 * amplitude. 4% and a two-second cycle is about where a pulse stops reading as
 * an animation and starts reading as something being alive.
 *
 * Under Reduce Motion the pulse stops and the recording state is carried by
 * colour and the ring alone. That is a real substitution rather than a
 * degradation: both states remain distinguishable without motion, which is the
 * accessibility requirement.
 */

type Props = {
  recording: boolean;
  size?: number;
  color?: string;
};

export default function AnimatedMic({
  recording,
  size = 56,
  color = grocery.blue,
}: Props) {
  const pulse = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    cancelAnimation(pulse);
    if (!recording || reduced) {
      pulse.value = withTiming(0, { duration: 160 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [recording, reduced, pulse]);

  const micStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.04 }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + pulse.value * 0.22,
    transform: [{ scale: 1 + pulse.value * 0.12 }],
  }));

  const tint = recording ? '#FF4B4B' : color;

  return (
    <View style={{ width: size, height: size }}>
      {recording ? (
        <Animated.View
          pointerEvents="none"
          style={[
            s.halo,
            { borderRadius: size, backgroundColor: tint },
            haloStyle,
          ]}
        />
      ) : null}
      <Animated.View
        style={[
          s.mic,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: tint,
          },
          micStyle,
        ]}
      >
        <Mic size={size * 0.45} color="white" strokeWidth={2.4} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  halo: { position: 'absolute', top: -6, left: -6, right: -6, bottom: -6 },
  mic: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#345B73',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});
