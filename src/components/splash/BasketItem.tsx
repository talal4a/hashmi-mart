import React, { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { ImageSourcePropType, ImageStyle } from 'react-native';
import type { PartBox } from './parts';
import cancelAll from '../../utils/cancelAll';
import {
  PAD_TOP,
  POP_DELAY,
  POP_MS,
  POP_RISE,
  POP_STAGGER,
  POP_TILT,
} from './tokens';

/** The pop: out to ~110% before falling back to exactly 1. The overshoot is what
 *  makes it read as something landing rather than something being resized. */
const EASE_POP = Easing.bezier(0.34, 1.56, 0.64, 1);

type Props = {
  /** Tight box of this piece within the mark, in dp. */
  box: PartBox;
  source: ImageSourcePropType;
  /** Position in the left-to-right order; sets both the delay and the tilt side. */
  index: number;
};

/**
 * One piece of shopping popping into the basket.
 *
 * Because the layer is cropped tight to the piece, the scale happens about the
 * piece's own centre — so it grows out of its resting place instead of sliding in
 * from the middle of the logo. It also rises the last few dp and untilts as it
 * lands, which is the difference between a pop and a zoom.
 *
 * The tilt alternates so the row doesn't lean one way, and the timing is a plain
 * bezier rather than a spring: every piece has to be provably at rest before the
 * stencil seals over the mark at SEAL_DELAY.
 */
export default function BasketItem({ box, source, index }: Props) {
  const pop = useSharedValue(0);

  useEffect(() => {
    pop.value = withDelay(
      POP_DELAY + index * POP_STAGGER,
      withTiming(1, { duration: POP_MS, easing: EASE_POP }),
    );
    // Five of these mount, so this is five values that must be at rest before the
    // splash's navigation.reset() deletes them. See utils/cancelAll.
    return () => {
      cancelAll([pop]);
    };
  }, []);

  const tilt = index % 2 === 0 ? POP_TILT : -POP_TILT;

  const style = useAnimatedStyle(() => ({
    // Near-instant, so it never reads as a fade — it just stops the piece being
    // a visible speck at the bottom of the pop.
    opacity: Math.min(1, pop.value / 0.15),
    transform: [
      { translateY: POP_RISE * (1 - pop.value) },
      { rotate: `${tilt * (1 - pop.value)}deg` },
      { scale: pop.value },
    ],
  }));

  const layout: ImageStyle = {
    position: 'absolute',
    left: box.x,
    top: PAD_TOP + box.y,
    width: box.w,
    height: box.h,
  };

  return (
    <Animated.Image
      source={source}
      style={[layout, style]}
      resizeMode="stretch"
    />
  );
}
