import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import cancelAll from '../../utils/cancelAll';
import {
  DRIFT,
  LOGO_W,
  SPLASH_BG,
  WIPE_DELAY,
  WIPE_MS,
  WORDMARK_H,
} from './tokens';

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

type Props = {
  /** 0→1 hand-off driver, owned by SplashSequence. */
  exit: SharedValue<number>;
};

/**
 * "HASHMI MART", revealed left to right under the mark.
 *
 * Staging the wordmark separately from the mark is most of what separates a
 * launch screen from a logo that simply appears — and it is possible without
 * the vector file, because logo.png has a clean 60px transparent band between
 * the two halves.
 *
 * The reveal is a curtain of field colour sliding off the letters, not an
 * animated `width`. Same result, but it is a transform rather than a layout
 * prop, so it stays off the layout path entirely.
 */
export default function LogoWordmark({ exit }: Props) {
  const wipe = useSharedValue(0);

  useEffect(() => {
    wipe.value = withDelay(
      WIPE_DELAY,
      withTiming(1, { duration: WIPE_MS, easing: EASE_OUT }),
    );
    // At rest before the splash's navigation.reset() deletes these views. See
    // utils/cancelAll.
    return () => {
      cancelAll([wipe]);
    };
  }, []);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ translateY: DRIFT * exit.value }],
  }));

  // Comes up to strength over the first stretch of the wipe, so the leading
  // letters emerge rather than snapping on at the curtain's edge.
  const wordStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, wipe.value / 0.4),
  }));

  const curtainStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: LOGO_W * wipe.value }],
  }));

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      <Animated.Image
        source={require('../../assets/images/splash/wordmark.png')}
        style={[styles.fill, wordStyle]}
        resizeMode="stretch"
      />
      <Animated.View style={[styles.fill, styles.curtain, curtainStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: LOGO_W,
    height: WORDMARK_H,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: LOGO_W,
    height: WORDMARK_H,
  },
  curtain: {
    backgroundColor: SPLASH_BG,
  },
});
