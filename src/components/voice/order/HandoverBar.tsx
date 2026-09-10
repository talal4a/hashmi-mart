import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ArrowRight } from 'lucide-react-native';
import PressableScale from '../../ui/PressableScale';
import { C, buttons } from './theme';

/**
 * The moment the order leaves the sheet, made visible.
 *
 * Items used to be added after a silent 900ms, which is long enough to be a
 * delay and too short to be a decision — the screen changed and the customer
 * found out afterwards. A bar that fills says the same thing out loud: this is
 * happening, here is how long you have, and here is the way to stop it.
 *
 * Stopping is not a cancel. It turns the same sentence into a button, so the
 * only difference between waiting and tapping is who chose the moment.
 */

const plural = (n: number) => (n === 1 ? 'item' : 'items');

function HandoverBar({
  count,
  durationMs,
  paused,
  onPause,
  onConfirm,
}: {
  count: number;
  durationMs: number;
  /** Frozen because the customer touched something. */
  paused: boolean;
  onPause: () => void;
  onConfirm: () => void;
}) {
  const reduced = useReducedMotion();
  const fill = useSharedValue(0);

  useEffect(() => {
    if (paused) {
      cancelAnimation(fill);
      return;
    }
    fill.value = 0;
    fill.value = reduced
      ? 1
      : withTiming(1, { duration: durationMs, easing: Easing.linear });
    return () => cancelAnimation(fill);
  }, [paused, durationMs, reduced, fill]);

  const grow = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  if (paused)
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Add ${count} ${plural(count)} to your cart`}
        onPress={onConfirm}
        style={buttons.primary}
      >
        <Text style={buttons.primaryText}>
          Add {count} {plural(count)} to cart
        </Text>
        <ArrowRight size={17} color={C.paper} />
      </PressableScale>
    );

  return (
    <View style={s.row}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Adding ${count} ${plural(count)} to your cart`}
        style={s.track}
      >
        <Animated.View style={[s.fill, grow]} />
        <Text style={s.label}>
          Adding {count} {plural(count)} to your cart…
        </Text>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Wait, I want to check the list"
        onPress={onPause}
        style={s.hold}
      >
        <Text style={s.holdText}>Wait</Text>
      </PressableScale>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: {
    flex: 1,
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: '#DCF1F9',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#BEE7F5',
  },
  label: { color: C.ink, fontSize: 13, fontWeight: '700' },
  hold: {
    minHeight: 54,
    paddingHorizontal: 15,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: C.paper,
  },
  holdText: { color: C.cyanDeep, fontSize: 12.5, fontWeight: '700' },
});

export default memo(HandoverBar);
