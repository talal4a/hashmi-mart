import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  Animated,
  Easing,
  View,
  type LayoutChangeEvent,
} from 'react-native';

export const SEGMENT_H = 42;

const BORDER = 1.5;
const PAD = 3;

export type Segment<T extends string> = {
  value: T;
  label: string;
  a11yLabel?: string;
};

type Props<T extends string> = {
  segments: readonly Segment<T>[];
  value: T | null;
  onChange: (value: T) => void;
  height?: number;
  duration?: number;
  accessibilityLabel?: string;
  disabled?: boolean;
};

/**
 * A row of choices with one sliding thumb.
 *
 * Uses RN's built-in Animated to avoid Reanimated + Fabric race conditions.
 *
 * Both values below run on the JS driver, and that is load-bearing rather than
 * lazy. `slot` has to: the thumb's travel is `PAD + i * seg`, and `seg` is not
 * known until `onLayout` measures the row, so the interpolation is rebuilt from a
 * JS number on render. `shown` could have been native on its own — but the two
 * meet inside one style object on the thumb, and RN makes a style all-or-nothing.
 * `AnimatedStyle.__makeNative` walks every node in the style and natives it, so
 * the first native `shown` animation drags `slot` across with it, and the next
 * `Animated.timing(slot, { useNativeDriver: false })` throws outright:
 * "Attempting to run JS driven animation on animated node that has been moved to
 * 'native' earlier". Not a warning, not dev-only — an unhandled throw out of the
 * effect, on the second tap. One driver per style object, and here the driver is
 * chosen for us.
 *
 * Nothing is lost by it. A single style feeding a single thumb costs one prop
 * update per frame either way, so the JS driver is already paying for the slide;
 * the fade rides along free. And the two now share a clock, where a native fade
 * over a JS slide would visibly drift apart under load.
 */
export default function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  height = SEGMENT_H,
  duration = 220,
  accessibilityLabel,
  disabled = false,
}: Props<T>) {
  const [width, setWidth] = useState(0);
  const index = segments.findIndex(s => s.value === value);

  const slot = useRef(new Animated.Value(index < 0 ? 0 : index)).current;
  const shown = useRef(new Animated.Value(index < 0 ? 0 : 1)).current;

  // Both values are constructed at the position `index` already implies, so the
  // first run of this effect was two JS-driver animations from a number to itself.
  // Cheap on its own and not on a screen that opens with nine avatar chips beside
  // it — and every value that never starts is one that cannot still be writing
  // when a reset deletes the view. Later runs are real: they answer a tap.
  const settled = useRef(false);

  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }

    const toSlot = index >= 0 ? index : undefined;
    const toShown = index < 0 ? 0 : 1;

    const anims: Animated.CompositeAnimation[] = [];
    if (toSlot !== undefined) {
      anims.push(
        Animated.timing(slot, {
          toValue: toSlot,
          duration,
          easing: Easing.bezier(0.32, 0.42, 0.68, 1),
          useNativeDriver: false, // translateX depends on width
        }),
      );
    }
    anims.push(
      Animated.timing(shown, {
        toValue: toShown,
        duration,
        easing: Easing.bezier(0.32, 0.42, 0.68, 1),
        useNativeDriver: false, // shares the thumb's style with slot — see above
      }),
    );
    Animated.parallel(anims).start();
    return () => {
      slot.stopAnimation();
      shown.stopAnimation();
    };
  }, [index]);

  const seg = width > 0 ? (width - 2 * BORDER - 2 * PAD) / segments.length : 0;
  const inner = height - 2 * BORDER - 2 * PAD;

  const thumbTranslateX = slot.interpolate({
    inputRange: segments.map((_, i) => i),
    outputRange: segments.map((_, i) => PAD + i * seg),
  });

  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        height,
        borderRadius: height / 2,
        borderWidth: BORDER,
        padding: PAD,
      }}
      className="flex-row border-[#e5e7eb] bg-[#f0f9ff]"
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: PAD,
          left: 0,
          width: seg,
          height: inner,
          borderRadius: inner / 2,
          borderWidth: BORDER,
          backgroundColor: '#ffffff',
          borderColor: '#06b6d4',
          opacity: shown,
          transform: [{ translateX: thumbTranslateX }],
        }}
        pointerEvents="none"
      />

      {segments.map(segment => (
        <SegmentButton
          key={segment.value}
          label={segment.label}
          a11yLabel={segment.a11yLabel ?? segment.label}
          selected={segment.value === value}
          disabled={disabled}
          duration={duration}
          onPress={() => onChange(segment.value)}
        />
      ))}
    </View>
  );
}

function SegmentButton({
  label,
  a11yLabel,
  selected,
  disabled,
  duration,
  onPress,
}: {
  label: string;
  a11yLabel: string;
  selected: boolean;
  disabled: boolean;
  duration: number;
  onPress: () => void;
}) {
  const on = useRef(new Animated.Value(selected ? 1 : 0)).current;

  // Same as the thumb above: the colour already starts where `selected` puts it,
  // so the first run had nothing to move.
  const settled = useRef(false);

  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    Animated.timing(on, {
      toValue: selected ? 1 : 0,
      duration,
      easing: Easing.bezier(0.32, 0.42, 0.68, 1),
      useNativeDriver: false, // color interpolation
    }).start();
    return () => {
      on.stopAnimation();
    };
  }, [selected]);

  // Interpolate between idle and active colors
  const textColor = on.interpolate({
    inputRange: [0, 1],
    outputRange: ['#5E7679', '#0e7490'],
  });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected, checked: selected, disabled }}
      className="flex-1 items-center justify-center"
    >
      <Animated.Text
        style={{ color: textColor }}
        numberOfLines={1}
        className="text-[13.5px] font-semibold"
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}

export const SEGMENT_LABEL = 'text-[13px] font-semibold text-[#5E7679]';
