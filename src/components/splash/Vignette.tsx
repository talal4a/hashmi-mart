import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

type Props = {
  /** 0→1 hand-off driver, owned by SplashSequence. */
  exit: SharedValue<number>;
};

/**
 * Edge darkening for the field.
 *
 * Flat colour reads as paint; a field that falls off at the corners reads as
 * space. It is a pre-rendered PNG rather than a gradient library so the splash
 * depends on nothing that could be missing from the native build — and it is
 * stretched rather than tiled, which is safe because a soft gradient has no
 * detail to distort.
 *
 * Two things it has to be careful about. Its transparent centre is wide enough
 * (superellipse, plateau 0.66) that it never reaches the logo box, because
 * LogoMark paints flat field colour there and any gradient underneath would show
 * through as a rectangle. And it fades out on the way off the screen: Onboarding
 * has no vignette, so leaving it up until the navigation cut would pop the
 * corners a shade brighter at exactly the moment nothing else is moving.
 */
export default function Vignette({ exit }: Props) {
  const style = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));

  return (
    <Animated.Image
      source={require('../../assets/images/splash/vignette.png')}
      style={[StyleSheet.absoluteFill, style]}
      resizeMode="stretch"
    />
  );
}
