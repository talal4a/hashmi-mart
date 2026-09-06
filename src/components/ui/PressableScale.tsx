import { ReactNode } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far it dips on press. 0.96 for cards, ~0.9 for small round buttons. */
  scaleTo?: number;
};

const spring = { damping: 18, stiffness: 320, mass: 0.5 };

/** The iOS press feel: a short spring dip instead of an opacity flash. */
export default function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }] as never,
  }));

  return (
    <AnimatedPressable
      style={[style, animated]}
      onPressIn={() => {
        scale.value = withSpring(scaleTo, spring);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, spring);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
