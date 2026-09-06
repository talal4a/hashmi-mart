import React, { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AUTH_EASE, STATE_MS } from '../auth/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * NOT RENDERED. Kept for reference only.
 *
 * This is the pill `GenderSelect` used before it became a segmented row. Three
 * of these laid out `flex-row flex-wrap gap-2` wrapped onto a second 42dp line
 * because "Prefer not to say" is too wide to share one, and that second line is
 * the 50dp the segmented control got back. Restore this only alongside a plan
 * for where the extra row comes from — see `SegmentedControl` for what replaced
 * it and `AvatarPicker` for the same trade made on the rail above.
 */
export default function GenderPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const on = useSharedValue(selected ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, {
      duration: STATE_MS,
      easing: AUTH_EASE,
    });
  }, [selected]);

  const pill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      on.value,
      [0, 1],
      ['#f0f9ff', '#cffafe'],
    ) as string,
    borderColor: interpolateColor(
      on.value,
      [0, 1],
      ['#e5e7eb', '#06b6d4'],
    ) as string,
    transform: [{ scale: scale.value }] as any,
  }));

  const text = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], ['#5E7679', '#0e7490']) as string,
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => (scale.value = withTiming(0.96, { duration: 110 }))}
      onPressOut={() =>
        (scale.value = withSpring(1, { damping: 14, stiffness: 240 }))
      }
      hitSlop={4}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[{ height: 42, paddingHorizontal: 16, borderWidth: 1.5 }, pill]}
      className="items-center justify-center rounded-full"
    >
      <Animated.Text style={text} className="text-[14px] font-semibold">
        {label}
      </Animated.Text>
    </AnimatedPressable>
  );
}
