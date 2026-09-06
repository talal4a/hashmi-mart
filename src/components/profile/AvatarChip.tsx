import React, { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, Animated, Easing, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { STATE_MS } from '../auth/motion';

const RING = 2.5;
const PAD = 3;

/**
 * Hoisted, and it has to be: built inside the component this would be a new
 * component type on every render, so React would unmount and remount the chip —
 * and each chip is ~100 elements — on every tap in the card.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  selected: boolean;
  onPress: () => void;
  label: string;
  size?: number;
  children: ReactNode;
};

/**
 * One tappable option in the avatar rail.
 *
 * Uses RN's built-in Animated to avoid Reanimated + Fabric race conditions
 * during navigation.reset().
 *
 * The ring is an `AnimatedPressable` rather than a plain `Pressable`, which is
 * not a style choice. An interpolation is a graph node, not a value: it only
 * produces a colour once something attaches it, and only an `Animated.*`
 * component does that. Handed to a plain view it arrives at the native side as an
 * object where a colour is expected — so the ring silently kept its grey and the
 * selected state had no ring at all.
 *
 * `on` drives colour, so it runs on the JS driver, matching what SegmentedControl
 * already does for its label colour. `borderColor` is on RN's native-driver
 * allowlist and would probably work there too, but a value can only have one
 * driver and this one also moves the tick — so the choice is between proving out
 * native colour support on Android or spending the JS thread on a 220ms fade of a
 * 20dp badge. The badge is not worth the risk. `scale` is a separate value and
 * stays native, which is where smoothness is actually felt.
 */
export default function AvatarChip({
  selected,
  onPress,
  label,
  size = 52,
  children,
}: Props) {
  const on = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  // The value already starts where `selected` says it should, so the first run of
  // this effect animated from a number to itself: a 220ms JS-driver frame loop per
  // chip, up to nine of them, all starting the moment the screen appears and none
  // of them changing a pixel. Skipping it is why the rail now opens still.
  const settled = useRef(false);
  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    Animated.timing(on, {
      toValue: selected ? 1 : 0,
      duration: STATE_MS,
      easing: Easing.bezier(0.32, 0.42, 0.68, 1),
      useNativeDriver: false, // drives borderColor — see the note above
    }).start();
    return () => {
      on.stopAnimation();
    };
  }, [selected]);

  // The press spring outlives the release by ~150ms, and a chip can be the last
  // thing touched before the form navigates away. Same reason GoogleAuthButton
  // stops its own: nothing should still be writing when the view goes.
  useEffect(() => {
    return () => {
      scale.stopAnimation();
    };
  }, []);

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.94,
      duration: 110,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      damping: 14,
      stiffness: 240,
      useNativeDriver: true,
    }).start();
  };

  const box = size + 2 * (RING + PAD);

  const borderColor = on.interpolate({
    inputRange: [0, 1],
    outputRange: ['#e5e7eb', '#06b6d4'],
  });

  const tickOpacity = on;
  const tickTranslateY = on.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 0],
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={6}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        style={{
          width: box,
          height: box,
          borderRadius: box / 2,
          borderWidth: RING,
          padding: PAD,
          backgroundColor: '#ffffff',
          borderColor,
        }}
      >
        <View
          style={{ width: size, height: size, borderRadius: size / 2 }}
          className="items-center justify-center overflow-hidden bg-[#f0f9ff]"
        >
          {children}
        </View>

        <Animated.View
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#06b6d4',
            borderWidth: 2,
            borderColor: '#ffffff',
            opacity: tickOpacity,
            transform: [{ translateY: tickTranslateY }],
          }}
          className="items-center justify-center"
          pointerEvents="none"
        >
          <Check size={11} color="#ffffff" strokeWidth={3.5} />
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
}
