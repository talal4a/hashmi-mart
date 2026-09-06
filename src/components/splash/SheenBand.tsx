import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { LOGO_W, MARK_H, SHEEN_W } from './tokens';

type Props = {
  /** 0→1 for one pass. Owned by LogoMark so the pass can be timed against the
   *  mark's own brightening. */
  progress: SharedValue<number>;
};

/**
 * A single pass of light across the mark.
 *
 * This is the replacement for the three sliding bars. Hard-edged bars sliding
 * on a loop are a comic-book convention — that is a motif problem, not a timing
 * one, so no amount of easing would have fixed it. Light has soft edges, passes
 * once, and reads as a property of the surface rather than a drawing on top
 * of it.
 *
 * The band's lean is baked into the PNG rather than applied with a rotate
 * transform, so this component only ever translates on X. Two reasons: RN's
 * transform array order makes translate-then-rotate easy to get subtly wrong,
 * and a rotated child inside `overflow: hidden` needs overhang on all sides to
 * avoid revealing its corners.
 */
export default function SheenBand({ progress }: Props) {
  const style = useAnimatedStyle(() => ({
    // Fades at both ends so the band is never visible sitting still at the edge
    // of the mark, waiting to start.
    opacity: interpolate(progress.value, [0, 0.12, 0.82, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-SHEEN_W, LOGO_W]) },
    ],
  }));

  return (
    <Animated.Image
      source={require('../../assets/images/splash/sheen.png')}
      style={[styles.band, style]}
      resizeMode="stretch"
    />
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SHEEN_W,
    height: MARK_H,
  },
});
