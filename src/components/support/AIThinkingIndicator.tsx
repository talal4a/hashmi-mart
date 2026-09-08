import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { support } from './supportTheme';

/**
 * Three cyan dots moving as a soft wave. Not an ActivityIndicator, ever.
 *
 * PRD sections 8.3 and 18 both name the generic spinner specifically, and the
 * reason is worth keeping in view: a platform spinner says "this app is
 * working", while a wave in the assistant's own colour says "Hashmi AI is
 * thinking about what you asked". The second one is the thing being built.
 *
 * One clock drives all three dots. Each reads the same phase at its own offset,
 * so the wave stays in step no matter when a dot mounts, and the whole
 * indicator costs one shared value and zero React renders per frame.
 *
 * The `collapse` prop is the other half of section 8.4. When the answer begins,
 * the caller drives this from 0 to 1 and the dots slide toward the centre and
 * compress rather than vanishing — the answer container then expands out of
 * where they went. A cut here is what makes an answer feel like a page swap
 * instead of a reply.
 */

type Props = {
  active?: boolean;
  /** 0 = wave; 1 = gathered at the centre and faded. Drive it to open an answer. */
  collapse?: SharedValue<number>;
};

const DOTS = 3;
const GAP = 7;
const SIZE = 7;

function Dot({
  phase,
  index,
  collapse,
  reduced,
}: {
  phase: SharedValue<number>;
  index: number;
  collapse?: SharedValue<number>;
  reduced: boolean;
}) {
  // Centre-relative, so collapsing is a slide toward 0 rather than toward a
  // hard-coded pixel the caller would have to know about.
  const offset = (index - (DOTS - 1) / 2) * (SIZE + GAP);

  const style = useAnimatedStyle(() => {
    const gathered = collapse?.value ?? 0;
    // Each dot trails the one before it by a fifth of a cycle: enough for the
    // eye to read a direction, not so much that they stop looking related.
    const local = (phase.value - index * 0.18) % 1;
    const wave = Math.sin(((local + 1) % 1) * Math.PI * 2);
    return {
      opacity: (0.45 + 0.55 * (wave * 0.5 + 0.5)) * (1 - gathered),
      transform: [
        { translateX: offset * (1 - gathered) - offset },
        { translateY: reduced ? 0 : wave * -3 * (1 - gathered) },
        {
          scale: reduced
            ? 1
            : (0.85 + 0.25 * (wave * 0.5 + 0.5)) * (1 - gathered * 0.4),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: '50%',
          marginLeft: offset - SIZE / 2,
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          backgroundColor: support.accent,
        },
        style,
      ]}
    />
  );
}

export default function AIThinkingIndicator({
  collapse,
  active = true,
}: Props) {
  const phase = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!active) {
      cancelAnimation(phase);
      return;
    }
    if (reduced) {
      // Reduce Motion still needs a visible "working" state, so the wave becomes
      // a slow, uniform breath rather than nothing at all.
      phase.value = withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.linear }),
        -1,
        false,
      );
      return () => cancelAnimation(phase);
    }
    phase.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(phase);
  }, [phase, reduced, active]);

  return (
    <View
      style={s.row}
      accessibilityRole="progressbar"
      accessibilityLabel="Hashmi AI is thinking"
    >
      {Array.from({ length: DOTS }, (_, index) => (
        <Dot
          key={index}
          phase={phase}
          index={index}
          collapse={collapse}
          reduced={reduced}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    width: DOTS * SIZE + (DOTS - 1) * GAP,
    height: 18,
    justifyContent: 'center',
  },
});
