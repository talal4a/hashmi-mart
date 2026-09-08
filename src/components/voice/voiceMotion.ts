import { withSpring, withTiming } from 'react-native-reanimated';

export const recorderReveal = () => {
  'worklet';
  return {
    initialValues: {
      opacity: 0,
      transform: [{ translateY: 20 }, { scale: 0.96 }],
    },
    animations: {
      opacity: withTiming(1, { duration: 170 }),
      transform: [
        {
          translateY: withSpring(0, { damping: 24, stiffness: 280, mass: 0.7 }),
        },
        { scale: withTiming(1, { duration: 220 }) },
      ],
    },
  };
};
export const recorderSend = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 180 }),
      transform: [
        { translateY: withTiming(-18, { duration: 180 }) },
        { scale: withTiming(0.88, { duration: 180 }) },
      ],
    },
  };
};
export const recorderDismiss = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 160 }),
      transform: [
        { translateY: withTiming(14, { duration: 160 }) },
        { scale: withTiming(0.96, { duration: 160 }) },
      ],
    },
  };
};
