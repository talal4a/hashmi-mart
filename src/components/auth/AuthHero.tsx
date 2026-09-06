import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ENTER_MS } from './motion';
import BrandMark from './BrandMark';
import { CARD_LIFT, HERO_COLORS, HERO_LOCATIONS } from './heroTokens';

/** Less travel than the card's 22dp: two things rising the same distance read
 *  as one sheet, two rising different distances read as depth. */
const HERO_RISE = 12;

type Props = {
  title: string;
  subtitle: string;
};

/**
 * The dark gradient band Login and Sign Up open with.
 *
 * The transparent lockup is tinted white so both the cart and wordmark stay
 * clear against the dark teal gradient. Keep 16dp between it and the title.
 *
 * Uses RN's built-in Animated to avoid Reanimated + Fabric race conditions
 * during navigation.reset().
 */
export default function AuthHero({ title, subtitle }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(HERO_RISE)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.bezier(0.32, 0.42, 0.68, 1),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTER_MS,
        easing: Easing.bezier(0.32, 0.42, 0.68, 1),
        useNativeDriver: true,
      }),
    ]).start();
    return () => {
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, []);

  return (
    <LinearGradient
      colors={HERO_COLORS}
      locations={HERO_LOCATIONS}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 14 + CARD_LIFT,
        paddingHorizontal: 28,
      }}
    >
      <Animated.View
        style={{ opacity, transform: [{ translateY }] }}
        className="items-center"
      >
        <BrandMark tintColor="#ffffff" />

        <Text
          accessibilityRole="header"
          className="mt-4 text-center text-[26px] font-bold leading-tight text-white"
        >
          {title}
        </Text>

        <Text
          className="mt-2 max-w-[300px] text-center text-[13px] leading-[19px]"
          style={{ color: 'rgba(255,255,255,0.78)' }}
        >
          {subtitle}
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}
