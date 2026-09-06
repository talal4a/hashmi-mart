import React from 'react';
import { Pressable, Text, type ViewStyle } from 'react-native';
import { Animated, Easing } from 'react-native';

const RADIUS = 16;

type ThemedButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'google';
  icon?: React.ReactNode;
  style?: ViewStyle;
  className?: string;
  disabled?: boolean;
  radius?: number;
};

/**
 * Reusable themed button with press scale animation.
 *
 * Uses RN's built-in Animated to avoid Reanimated + Fabric race conditions.
 */
export default function ThemedButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  style,
  disabled = false,
  radius = RADIUS,
}: ThemedButtonProps) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.96,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      damping: 14,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  };

  const variants = {
    primary: { bg: '#06b6d4', text: 'white', border: 'transparent' },
    outline: { bg: 'transparent', text: '#0B2027', border: '#e5e7eb' },
    google: { bg: 'white', text: '#0B2027', border: '#e5e7eb' },
  };
  const v = variants[variant];

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={disabled ? undefined : handlePressIn}
        onPressOut={disabled ? undefined : handlePressOut}
        disabled={disabled}
        style={[
          {
            backgroundColor: v.bg,
            borderWidth: variant === 'primary' ? 0 : 1,
            borderColor: v.border,
            borderRadius: radius,
            opacity: disabled ? 0.5 : 1,
            height: 56,
          },
          style,
        ]}
        className="flex-row items-center justify-center"
      >
        {icon}
        <Text
          className="text-center text-[16px] font-semibold"
          style={{ color: v.text }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
