import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { grocery } from '../home/groceryTheme';

/**
 * Where you are in checkout, from the first frame to the last.
 *
 * Checkout used to be one screen that became a different screen when the order
 * went through, and nothing anywhere said how many screens there were. You did
 * not know an order was two taps away rather than one, and after paying you did
 * not know whether the receipt was the end.
 *
 * Three named stages, pinned above the scroll, answer both: Details is where
 * you change things, Preview is where you check them, Receipt is where it ends.
 * Named for what happens on them rather than Review/Confirm/Complete, which
 * describe the act of moving rather than the place you are.
 *
 * The line between two nodes fills rather than switches. A rail that flips
 * colour on arrival has three discrete states and cannot show that something is
 * under way; one that is part-filled is a step in progress, and that is the
 * whole reason this sits above a form that takes half a minute to fill in.
 */

export const CHECKOUT_STEPS = ['Details', 'Preview', 'Receipt'] as const;
export type CheckoutStep = (typeof CHECKOUT_STEPS)[number];

/** Small on purpose. This is orientation, not the subject of the screen. */
const DOT = 26;

export default function CheckoutStepper({ at }: { at: number }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(at);

  useEffect(() => {
    progress.value = reduced
      ? at
      : withSpring(at, { damping: 19, stiffness: 130, mass: 0.8 });
  }, [at, reduced, progress]);

  return (
    <View
      style={s.rail}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${at + 1} of ${CHECKOUT_STEPS.length}: ${
        CHECKOUT_STEPS[at] ?? ''
      }`}
    >
      {CHECKOUT_STEPS.map((label, index) => (
        <View key={label} style={index === 0 ? s.firstCell : s.cell}>
          {index > 0 ? <Track index={index} progress={progress} /> : null}
          <Node index={index} at={at} label={label} progress={progress} />
        </View>
      ))}
    </View>
  );
}

/** The line into a node, filled left to right as the stage advances. */
function Track({
  index,
  progress,
}: {
  index: number;
  progress: SharedValue<number>;
}) {
  const fill = useAnimatedStyle(() => ({
    // Scaled, not widened: a width in an animated style is a layout pass per
    // frame, and this rail sits above a screen that is also animating.
    transform: [
      { scaleX: Math.min(1, Math.max(0, progress.value - (index - 1))) },
    ],
  }));
  return (
    <View style={s.track}>
      <Animated.View style={[s.trackFill, fill]} />
    </View>
  );
}

function Node({
  index,
  at,
  label,
  progress,
}: {
  index: number;
  /** The live step as a prop: colours are a render decision, and `progress`
   *  moves on the UI thread without re-rendering anything. */
  at: number;
  label: string;
  progress: SharedValue<number>;
}) {
  const done = index < at;
  const here = index === at;

  /** 0 → ahead, 1 → here, 2 → done. Animated, so the swap is not a jump cut. */
  const state = useDerivedValue(() => {
    const p = progress.value;
    if (p >= index + 0.8) return 2;
    if (p >= index - 0.2) return 1;
    return 0;
  });

  const dot = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      state.value,
      [0, 1, 2],
      ['#FFFFFF', grocery.blue, '#CFEFFB'],
    ),
    borderColor: interpolateColor(
      state.value,
      [0, 1, 2],
      ['#D9E6ED', grocery.blue, '#CFEFFB'],
    ),
    transform: [
      { scale: withTiming(state.value === 1 ? 1 : 0.94, { duration: 200 }) },
    ],
  }));

  const tick = useAnimatedStyle(() => ({
    opacity: withTiming(state.value === 2 ? 1 : 0, { duration: 160 }),
  }));
  const digit = useAnimatedStyle(() => ({
    opacity: withTiming(state.value === 2 ? 0 : 1, { duration: 160 }),
  }));

  const text = useAnimatedStyle(() => ({
    color: interpolateColor(
      state.value,
      [0, 1, 2],
      ['#9BB0BE', grocery.ink, '#3E8FAE'],
    ),
  }));

  return (
    <View style={s.node}>
      <Animated.View style={[s.dot, dot]}>
        <Animated.View style={[s.layer, digit]}>
          <Text style={[s.digit, here && s.digitHere]}>{index + 1}</Text>
        </Animated.View>
        <Animated.View style={[s.layer, tick]}>
          <Check size={13} color="#0B6C8C" strokeWidth={3.2} />
        </Animated.View>
      </Animated.View>
      <Animated.Text
        numberOfLines={1}
        style={[s.label, here && s.labelHere, text]}
      >
        {label}
      </Animated.Text>
      {/* Read out instead of the decoration above it. */}
      <View
        accessible
        accessibilityLabel={`${label}, ${
          done ? 'done' : here ? 'current step' : 'not started'
        }`}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

const s = StyleSheet.create({
  rail: { flexDirection: 'row', alignItems: 'flex-start' },
  // The first node hugs the left edge; the rest are pushed apart by their
  // tracks, so the three labels sit at the ends and middle of the row.
  firstCell: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, flexDirection: 'row', alignItems: 'center' },

  node: { width: 66, alignItems: 'center', gap: 5 },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 11.5, fontWeight: '900', color: '#9BB0BE' },
  digitHere: { color: grocery.white },
  label: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.1 },
  labelHere: { fontWeight: '900' },

  // Sits behind the labels' line, level with the dots.
  track: {
    flex: 1,
    height: 2,
    marginHorizontal: -6,
    marginBottom: 17,
    borderRadius: 2,
    backgroundColor: '#E2EDF3',
    overflow: 'hidden',
  },
  trackFill: {
    width: '100%',
    height: 2,
    borderRadius: 2,
    backgroundColor: grocery.blue,
    transformOrigin: 'left',
  },
});
