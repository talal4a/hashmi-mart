import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Bot } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { support } from './supportTheme';

/**
 * Hashmi AI's face.
 *
 * The same bot glyph as the button in the home search bar, on the same cyan.
 * That is the whole design argument: the user taps a bot and a bot answers, so
 * the thing they tapped and the thing that replies must be recognisably one
 * character. An earlier version drew a shopping basket here — on brand for the
 * store, but it made the assistant look like a *cart* rather than someone to
 * talk to, and it shared nothing with the control that opened it.
 *
 * The disc is a gradient rather than the button's flat fill. At 30px beside a
 * message it needs a little more presence than a tab-bar control, and the
 * gradient is what separates "identity" from "button" without changing the hue.
 *
 * Three states, and the restraint is the specification:
 *
 *   idle      a breath every few seconds, ~3% — barely visible, and that is the
 *             point. A continuously bouncing avatar reads as a loading spinner.
 *   thinking  a soft cyan ring, no scale. The ring is doing the work the dots
 *             are doing below it, so the avatar staying still keeps them legible.
 *   speaking  exactly one pulse, on the first token. Not a repeat.
 */

export type AvatarState = 'idle' | 'thinking' | 'speaking';

type Props = { size?: number; state?: AvatarState };

export default function HashmiAvatar({ size = 34, state = 'idle' }: Props) {
  const breath = useSharedValue(0);
  const ring = useSharedValue(0);
  const pulse = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    cancelAnimation(breath);
    if (state !== 'idle' || reduced) {
      breath.value = withTiming(0, { duration: 200 });
      return;
    }
    // Long pause, short breath. The delay is most of the cycle so the movement
    // arrives as a small surprise rather than a rhythm you start watching.
    breath.value = withRepeat(
      withSequence(
        withDelay(2600, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(breath);
  }, [state, reduced, breath]);

  useEffect(() => {
    cancelAnimation(ring);
    if (state !== 'thinking' || reduced) {
      ring.value = withTiming(0, { duration: 200 });
      return;
    }
    ring.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(ring);
  }, [state, reduced, ring]);

  useEffect(() => {
    if (state !== 'speaking' || reduced) return;
    // Deliberately not a repeat: this marks the arrival of the first token, and
    // an arrival that keeps happening is not an arrival.
    pulse.value = withSequence(
      withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 320, easing: Easing.inOut(Easing.quad) }),
    );
  }, [state, reduced, pulse]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.03 + pulse.value * 0.06 }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value * 0.55,
    transform: [{ scale: 1 + ring.value * 0.16 }],
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        pointerEvents="none"
        style={[s.ring, { borderRadius: size }, ringStyle]}
      />
      <Animated.View style={markStyle}>
        <LinearGradient
          colors={['#4FD3FF', support.accentDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            s.disc,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          {/* Matched to the home search bar's button: white glyph, same family.
              Half the disc leaves the optical margin a round badge needs — a
              larger glyph reads as cramped rather than bold. */}
          <Bot
            size={Math.round(size * 0.5)}
            color="#FFFFFF"
            strokeWidth={2.2}
          />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderWidth: 2,
    borderColor: support.accent,
  },
});
