import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { GAP, WORDMARK_H } from './tokens';

const { width, height } = Dimensions.get('screen');
const SEED = 120;
/** Enough to put the corners inside the circle, plus room for the offset that
 *  centres it on the cart rather than on the column. */
const COVER = (Math.hypot(width, height) / SEED) * 1.15;

type Props = {
  /** 0→1 hand-off driver, owned by SplashSequence. */
  exit: SharedValue<number>;
  /** The destination screen's background — see EXIT_BG. */
  color: string;
};

/**
 * The hand-off: a disc of the next screen's colour opening from behind the cart.
 *
 * It is composited last, over the lockup and the vignette, so whatever it has
 * reached is simply the destination's field — no half-transparent logo, no
 * vignette left hanging over the next screen's corners. SplashSequence only
 * mounts it when the destination colour actually differs from SPLASH_BG, which
 * is why it can afford to be opaque.
 *
 * Worth being clear that this is the one thing that scales, and it is a reveal
 * rather than the logo: nothing about the mark grows or shrinks on exit.
 */
export default function ExitReveal({ exit, color }: Props) {
  const style = useAnimatedStyle(() => ({
    // Guard the resting state: a zero-scaled circle can still leave a dot.
    opacity: exit.value > 0 ? 1 : 0,
    transform: [{ scale: exit.value * COVER }],
  }));

  return (
    <Animated.View
      style={[styles.disc, { backgroundColor: color }, style]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  disc: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: SEED,
    height: SEED,
    borderRadius: SEED / 2,
    marginLeft: -SEED / 2,
    // Lifted so it opens from the cart, not from the middle of the whole lockup.
    marginTop: -SEED / 2 - (GAP + WORDMARK_H) / 2,
  },
});
