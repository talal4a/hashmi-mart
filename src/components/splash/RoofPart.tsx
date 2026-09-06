import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { ROOF } from './parts';
import cancelAll from '../../utils/cancelAll';
import { PAD_TOP, ROOF_DELAY, ROOF_MS, ROOF_TRAVEL } from './tokens';

/** Overshoots by ~7% of the travel, so the roof settles onto the cart instead of
 *  stopping dead on it. Deterministic, unlike a spring: it is exactly seated at
 *  ROOF_MS, which is what lets the stencil seal at a known time. */
const EASE_SEAT = Easing.bezier(0.34, 1.4, 0.64, 1);

/**
 * The roof, descending to seat itself on the cart.
 *
 * It fades in over the first stretch of the fall rather than waiting above in
 * plain sight, so the first thing on screen is the cart alone and the roof
 * arrives to meet it.
 *
 * The roof and the basket overlap in the artwork, and they overlap more while the
 * roof is still high. That costs nothing here: both parts are flat white on a
 * flat field, so overlapping paint is invisible and no z-order needs deciding.
 */
export default function RoofPart() {
  const seat = useSharedValue(0);

  useEffect(() => {
    seat.value = withDelay(
      ROOF_DELAY,
      withTiming(1, { duration: ROOF_MS, easing: EASE_SEAT }),
    );
    // Nothing should still be moving when the splash's navigation.reset() deletes
    // these views. See utils/cancelAll.
    return () => {
      cancelAll([seat]);
    };
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, seat.value / 0.4),
    transform: [{ translateY: -ROOF_TRAVEL * (1 - seat.value) }],
  }));

  return (
    <Animated.Image
      source={require('../../assets/images/splash/roof.png')}
      style={[styles.roof, style]}
      resizeMode="stretch"
    />
  );
}

const styles = StyleSheet.create({
  roof: {
    position: 'absolute',
    left: ROOF.x,
    top: PAD_TOP + ROOF.y,
    width: ROOF.w,
    height: ROOF.h,
  },
});
