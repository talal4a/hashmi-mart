import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { STATE_MS } from './motion';

/**
 * FormError's quieter sibling: something the user should know, but nothing they
 * did and nothing that blocks them.
 *
 * Uses RN's built-in Animated to avoid Reanimated + Fabric race conditions.
 */
export default function FormNotice({ message }: { message?: string | null }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: message ? 1 : 0,
      duration: STATE_MS,
      easing: Easing.bezier(0.32, 0.42, 0.68, 1),
      useNativeDriver: true,
    }).start();
    return () => {
      opacity.stopAnimation();
    };
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View
      style={{ opacity }}
      accessibilityLiveRegion="polite"
      className="flex-row items-start rounded-xl bg-amber-50 px-3 py-2.5"
    >
      <View className="mt-0.5">
        <Info size={16} color="#b45309" />
      </View>
      <Text className="ml-2 flex-1 text-[13px] leading-5 text-[#92400e]">
        {message}
      </Text>
    </Animated.View>
  );
}
