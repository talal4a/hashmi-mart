import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { grocery } from '../home/groceryTheme';

/**
 * The live level meter, shared by Voice Order and AI Support.
 *
 * Amplitude arrives as one `SharedValue` holding the whole history rather than
 * one shared value per bar. That is not a micro-optimisation: at 24 bars and a
 * ~90ms sample the per-bar version writes 24 values from JS every tick and
 * schedules 24 separate UI-thread updates, which is exactly the "rerendering the
 * whole chat every animation frame" that PRD section 15 rules out. One array
 * write, twenty-four worklets reading their own index, no React render at all.
 *
 * Reduce Motion is handled by the caller declining to animate the *entry* of
 * this component. The bars themselves stay live, because they are not
 * decoration — they are the only feedback that the microphone is hearing
 * anything, and freezing them would leave a user who cannot tell whether the app
 * is recording.
 */

export const WAVEFORM_BARS = 24;

type Props = {
  /** Newest-last levels in 0..1. Length should be `bars`; short arrays read 0. */
  levels: SharedValue<number[]>;
  bars?: number;
  height?: number;
  color?: string;
  /** Drawn at rest, so an idle meter is a flat line rather than nothing. */
  minScale?: number;
};

const Bar = memo(function Bar({
  levels,
  index,
  height,
  color,
  minScale,
}: {
  levels: SharedValue<number[]>;
  index: number;
  height: number;
  color: string;
  minScale: number;
}) {
  const style = useAnimatedStyle(() => {
    const level = levels.value[index] ?? 0;
    // Timed rather than raw so a sampling interval that stutters reads as a
    // smooth meter instead of a strobe. 110ms is a little longer than the poll,
    // which is what makes consecutive samples overlap.
    return {
      transform: [
        { scaleY: withTiming(minScale + (1 - minScale) * level, { duration: 110 }) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { width: 3, height, borderRadius: 2, backgroundColor: color },
        style,
      ]}
    />
  );
});

function VoiceWaveform({
  levels,
  bars = WAVEFORM_BARS,
  height = 34,
  color = grocery.blue,
  minScale = 0.12,
}: Props) {
  // A gentle envelope so the meter reads as a shape rather than a picket fence;
  // the tallest bars sit in the middle where the eye already is.
  const heights = useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        const distance = Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
        return Math.round(height * (0.45 + 0.55 * (1 - distance * distance)));
      }),
    [bars, height],
  );

  return (
    <View style={[s.row, { height }]} pointerEvents="none" accessible={false}>
      {heights.map((barHeight, index) => (
        <Bar
          key={index}
          levels={levels}
          index={index}
          height={barHeight}
          color={color}
          minScale={minScale}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

export default memo(VoiceWaveform);
