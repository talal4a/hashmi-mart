import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Text, View } from 'react-native';
import { STATE_MS } from './motion';

/**
 * The spinner an auth screen shows while it works out what to render.
 *
 * Held back by a beat before fading in. A Firestore read that hits the local
 * cache resolves in a few milliseconds, and a spinner that appears and vanishes
 * inside one frame reads as a flicker — worse than no spinner at all. Waiting
 * costs nothing on the slow path, where the user is going to be here for long
 * enough that 200ms is invisible.
 *
 * Uses RN's built-in Animated to avoid Reanimated + Fabric race conditions.
 */
export default function AuthLoading({
  message = 'One moment…',
}: {
  message?: string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 1,
        duration: STATE_MS,
        easing: Easing.bezier(0.32, 0.42, 0.68, 1),
        useNativeDriver: true,
      }).start();
    }, 200);
    return () => {
      clearTimeout(timer);
      opacity.stopAnimation();
    };
  }, []);

  return (
    <View className="flex-1 items-center justify-center py-16">
      <Animated.View style={{ opacity }} className="items-center">
        <ActivityIndicator size="large" color="#06b6d4" />
        <Text
          accessibilityRole="text"
          className="mt-3 text-[14px] text-[#5E7679]"
        >
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}
