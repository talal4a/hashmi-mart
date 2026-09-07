import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
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
 * Drawn rather than emoji, because PRD section 6.1 asks for "a real HashmiMart
 * assistant asset, not a robot emoji" — and because an emoji is the platform's
 * artwork, not the brand's: it changes shape between Android versions and looks
 * like a placeholder that was never replaced. This is the app's own mark, built
 * from the same shopping-basket silhouette as the splash logo with the cyan the
 * rest of the product already uses.
 *
 * Three states, per section 8.8, and the restraint is the specification:
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
        <Svg width={size} height={size} viewBox="0 0 44 44">
          <Defs>
            <LinearGradient id="hm-disc" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#4FD3FF" />
              <Stop offset="1" stopColor={support.accentDeep} />
            </LinearGradient>
          </Defs>
          <Circle cx="22" cy="22" r="22" fill="url(#hm-disc)" />
          {/* The basket from the HashmiMart mark, simplified to read at 28px. */}
          <Path
            d="M13 17.5 H31 L28.8 30.5 C28.65 31.4 27.9 32 27 32 H17 C16.1 32 15.35 31.4 15.2 30.5 Z"
            fill="#FFFFFF"
            opacity={0.96}
          />
          <Path
            d="M17.6 17.5 C17.6 13.9 19.6 11.6 22 11.6 C24.4 11.6 26.4 13.9 26.4 17.5"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.3}
            strokeLinecap="round"
          />
          {/* The spark that says this basket answers back. */}
          <Path
            d="M33.2 10.4 L34.3 13.1 L37 14.2 L34.3 15.3 L33.2 18 L32.1 15.3 L29.4 14.2 L32.1 13.1 Z"
            fill="#FFFFFF"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
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
