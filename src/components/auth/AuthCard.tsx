import React, { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import { ENTER_MS, ENTER_RISE } from './motion';

/** `rounded-3xl`, as a number — the class it replaces, so nothing moves. */
const RADIUS = 24;

/**
 * The white squircle panel every auth screen sits in, plus the shared
 * fade-and-rise entry. Screens supply content only.
 *
 * Uses RN's built-in Animated (not Reanimated) with useNativeDriver to
 * avoid the SurfaceMountingManager race condition with Fabric during
 * navigation.reset(). Reanimated's UI-thread worklet cannot reliably
 * cancel before Fabric removes the native view.
 */
export default function AuthCard({
  children,
  radius = RADIUS,
  topRadius,
}: {
  children: ReactNode;
  radius?: number;
  topRadius?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(ENTER_RISE)).current;

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
    <Animated.View
      style={[
        {
          borderRadius: radius,
          borderTopLeftRadius: topRadius ?? radius,
          borderTopRightRadius: topRadius ?? radius,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      className="bg-white px-5 py-6"
    >
      {children}
    </Animated.View>
  );
}
