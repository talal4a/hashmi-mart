import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { grocery as c, HOME_GUTTER } from '../groceryTheme';

/**
 * A horizontal rail whose cards react to the scroll they are being dragged
 * through: the card leaving on the left eases back and dims, the one arriving
 * on the right settles forward. It is the same depth cue a shelf gives you in
 * real life, and it is what stops a row of cards reading as a flat list.
 */

type RailContext = {
  /** Live horizontal offset, read on the UI thread by every card. */
  scrollX: SharedValue<number>;
  /** Card width + gap: one card's worth of travel. */
  step: number;
  reducedMotion: boolean;
};

const RailCtx = createContext<RailContext | null>(null);

export const RAIL_GUTTER = HOME_GUTTER;

type RailProps = {
  children: ReactNode;
  /** Width of a single card, so cards can snap and self-position. */
  itemWidth: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  /** Colour the right-hand fade blends into. Matches the page behind it. */
  fadeColor?: string;
};

export function Rail({
  children,
  itemWidth,
  gap = 12,
  style,
  fadeColor = c.canvas,
}: RailProps) {
  const scrollX = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const step = itemWidth + gap;

  const onScroll = useAnimatedScrollHandler(event => {
    scrollX.value = event.contentOffset.x;
  });

  const ctx = useMemo(
    () => ({ scrollX, step, reducedMotion: !!reducedMotion }),
    [scrollX, step, reducedMotion],
  );

  return (
    <RailCtx.Provider value={ctx}>
      <View style={style}>
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={step}
          snapToAlignment="start"
          disableIntervalMomentum
          contentContainerStyle={[r.content, { gap }]}
        >
          {children}
        </Animated.ScrollView>
        {/* Soft bleed on the trailing edge: the row reads as continuing,
            rather than as a card that got clipped by accident. */}
        <LinearGradient
          pointerEvents="none"
          colors={[`${fadeColor}00`, fadeColor]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={r.fade}
        />
      </View>
    </RailCtx.Provider>
  );
}

type RailItemProps = {
  children: ReactNode;
  index: number;
  /** Entrance stagger between neighbours, in ms. */
  stagger?: number;
};

/**
 * Wraps one card: a spring entrance staggered off its neighbour, plus the
 * scroll-linked depth. Both collapse to a no-op under Reduce Motion.
 */
export function RailItem({ children, index, stagger = 70 }: RailItemProps) {
  const ctx = useContext(RailCtx);
  const enter = useSharedValue(ctx?.reducedMotion ? 1 : 0);

  useEffect(() => {
    if (ctx?.reducedMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(
      120 + index * stagger,
      withSpring(1, { damping: 16, stiffness: 140, mass: 0.7 }),
    );
  }, [ctx?.reducedMotion, enter, index, stagger]);

  const style = useAnimatedStyle(() => {
    if (!ctx || ctx.reducedMotion) return {};
    // Distance, in cards, between this card's resting slot and the viewport.
    const offset = (ctx.scrollX.value - index * ctx.step) / ctx.step;
    const depth = interpolate(offset, [0, 1], [1, 0.92], Extrapolation.CLAMP);
    const dim = interpolate(offset, [0, 1], [1, 0.55], Extrapolation.CLAMP);
    return {
      opacity: enter.value * dim,
      transform: [
        { translateY: (1 - enter.value) * 22 },
        { scale: depth * (0.94 + 0.06 * enter.value) },
      ],
    };
  });

  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Fades a whole section in on mount, under the rail's motion rules. */
export function SectionReveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const reducedMotion = useReducedMotion();
  const enter = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(delay, withTiming(1, { duration: 420 }));
  }, [reducedMotion, enter, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 14 }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

const r = StyleSheet.create({
  content: { paddingHorizontal: RAIL_GUTTER, paddingVertical: 8 },
  fade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 26,
  },
});
