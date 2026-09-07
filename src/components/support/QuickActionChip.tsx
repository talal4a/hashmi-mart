import { useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import PressableScale from '../ui/PressableScale';
import type { QuickAction } from '../../types/support';
import { QUICK_ACTIONS } from '../../config/support';
import { support, supportRadius } from './supportTheme';

/**
 * The six openers, and the first half of the send morph.
 *
 * PRD section 8.1 asks for a tapped chip to lift, travel toward the
 * conversation and *become* the outgoing message rather than disappearing while
 * a bubble appears elsewhere. Getting that to read as one object requires
 * knowing where the chip actually is on screen, which is what `measureInWindow`
 * below is for — the flying copy is drawn by `ChipFlight` in a full-screen
 * overlay, because a chip animating inside this row would be clipped by it the
 * moment it left.
 *
 * The measurement is taken at press time rather than on layout: the chip row
 * scrolls with the conversation, so a rect captured at mount is a rect that has
 * since moved.
 */

export type ChipRect = { x: number; y: number; width: number; height: number };

type Props = {
  onSelect: (action: QuickAction, from: ChipRect | null) => void;
  disabled?: boolean;
};

function Chip({
  action,
  index,
  onSelect,
  disabled,
}: {
  action: QuickAction;
  index: number;
  onSelect: Props['onSelect'];
  disabled?: boolean;
}) {
  const ref = useRef<View>(null);
  const reduced = useReducedMotion();

  const press = useCallback(() => {
    const node = ref.current;
    if (!node) {
      onSelect(action, null);
      return;
    }
    // `measureInWindow` is asynchronous and can return zeros for a view mid
    // layout. A null rect is a supported answer — the caller falls back to a
    // plain fade, which is also what Reduce Motion gets.
    node.measureInWindow((x, y, width, height) => {
      onSelect(
        action,
        width > 0 && height > 0 ? { x, y, width, height } : null,
      );
    });
  }, [action, onSelect]);

  return (
    <Animated.View
      ref={ref}
      collapsable={false}
      entering={reduced ? undefined : FadeIn.delay(index * 45).duration(240)}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={action.label}
        onPress={press}
        disabled={disabled}
        scaleTo={0.94}
        style={[s.chip, disabled && s.chipDisabled]}
      >
        <Text style={s.chipText}>{action.label}</Text>
      </PressableScale>
    </Animated.View>
  );
}

export default function QuickActions({ onSelect, disabled }: Props) {
  return (
    <View style={s.grid}>
      {QUICK_ACTIONS.map((action, index) => (
        <Chip
          key={action.id}
          action={action}
          index={index}
          onSelect={onSelect}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

/**
 * The chip in flight: a copy of it, in window coordinates, on its way to
 * becoming a message.
 *
 * It travels to the bottom-right of the conversation — where the user's message
 * lands — while its corner radius, fill and text colour cross over to the user
 * bubble's. Fading out over the last third is what hides the handover: the real
 * message has already been appended and is fading in underneath, so the eye
 * follows one shape the whole way.
 *
 * `onDone` fires from the UI thread via `runOnJS` at the end. It only clears the
 * overlay — the message and the AI request both started when the flight did, per
 * section 8.1's requirement that the request wait for the *visual* send to
 * begin, not to finish.
 */
export function ChipFlight({
  label,
  from,
  to,
  onDone,
}: {
  label: string;
  from: ChipRect;
  to: { x: number; y: number };
  onDone: () => void;
}) {
  const progress = useSharedValue(0);
  const started = useRef(false);

  if (!started.current) {
    started.current = true;
    progress.value = withTiming(
      1,
      { duration: 420, easing: Easing.bezier(0.32, 0.72, 0.24, 1) },
      finished => {
        if (finished) runOnJS(onDone)();
      },
    );
  }

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      transform: [
        { translateX: (to.x - from.x) * t },
        { translateY: (to.y - from.y) * t },
        // A small lift on the way out and a settle on the way in, so the path
        // is an arc rather than a slide.
        { scale: 1 + Math.sin(t * Math.PI) * 0.06 - t * 0.04 },
      ],
      opacity: t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28,
      backgroundColor: t < 0.35 ? support.aiSurface : support.userSurface,
      borderColor: t < 0.35 ? support.aiBorder : support.userSurface,
      borderTopRightRadius: supportRadius.chip - t * (supportRadius.chip - 6),
    };
  });

  const textStyle = useAnimatedStyle(() => ({
    color: progress.value < 0.35 ? support.ink : support.userInk,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.flight,
        { left: from.x, top: from.y, height: from.height },
        style,
      ]}
    >
      <Animated.Text numberOfLines={1} style={[s.chipText, textStyle]}>
        {label}
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: supportRadius.chip,
    backgroundColor: support.aiSurface,
    borderWidth: 1,
    borderColor: support.aiBorder,
  },
  chipDisabled: { opacity: 0.5 },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: support.ink,
    letterSpacing: -0.2,
  },
  flight: {
    position: 'absolute',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: supportRadius.chip,
  },
});
