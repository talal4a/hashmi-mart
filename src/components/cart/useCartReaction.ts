import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const settle = { damping: 18, stiffness: 300, mass: 0.55 };

/** Also callable directly from a flight worklet: landing stays on the UI thread. */
export function receiveCart(
  reaction: SharedValue<number>,
  badge: SharedValue<number>,
  reduced: boolean,
) {
  'worklet';
  cancelAnimation(reaction);
  cancelAnimation(badge);
  reaction.value = 0;
  reaction.value = withTiming(1, {
    duration: reduced ? 120 : 440,
    easing: Easing.linear,
  });
  badge.value = reduced
    ? 1
    : withSequence(withTiming(1.12, { duration: 90 }), withSpring(1, settle));
}

export function useCartReaction({
  reaction,
  enabled,
  reduced,
}: {
  reaction: SharedValue<number>;
  enabled: boolean;
  reduced: boolean;
}) {
  const idle = useSharedValue(0);
  const pressed = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(idle);
    cancelAnimation(pressed);
    idle.value = 0;
    pressed.value = 0;
    // Android spends its idle time fully at rest. iOS gets a barely visible
    // 1.2dp float with a long stationary pause; neither runs JS frame updates.
    if (enabled && !reduced && Platform.OS === 'ios') {
      idle.value = withRepeat(
        withSequence(
          withDelay(
            3600,
            withTiming(-1.2, {
              duration: 900,
              easing: Easing.inOut(Easing.sin),
            }),
          ),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }
    return () => {
      cancelAnimation(idle);
      cancelAnimation(pressed);
    };
  }, [enabled, reduced, idle, pressed]);

  const onPressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: reduced ? 60 : 85 });
  }, [pressed, reduced]);
  const onPressOut = useCallback(() => {
    pressed.value = reduced
      ? withTiming(0, { duration: 80 })
      : withSpring(0, settle);
  }, [pressed, reduced]);
  const cartStyle = useAnimatedStyle(() => {
    const r = reaction.value;
    const receiveY = reduced
      ? 0
      : interpolate(r, [0, 0.28, 0.55, 1], [0, 2, -1.5, 0]);
    const receiveScale = interpolate(
      r,
      [0, 0.28, 0.55, 1],
      reduced ? [1, 1.015, 1, 1] : [1, 1.06, 0.97, 1],
    );
    const angle = reduced
      ? 0
      : interpolate(r, [0, 0.28, 0.55, 1], [0, -3, 2, 0]);
    return {
      transform: [
        { perspective: 500 },
        {
          translateY:
            idle.value + receiveY + (reduced ? 0 : pressed.value * 1.5),
        },
        {
          scale: receiveScale * (1 - pressed.value * (reduced ? 0.015 : 0.045)),
        },
        { rotateX: `${reduced ? 0 : pressed.value * 4}deg` },
        { rotateZ: `${angle - (reduced ? 0 : pressed.value)}deg` },
      ],
    };
  });
  return { cartStyle, onPressIn, onPressOut };
}
