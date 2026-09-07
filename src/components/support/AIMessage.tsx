import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import HashmiAvatar from './HashmiAvatar';
import AIThinkingIndicator from './AIThinkingIndicator';
import { support, supportRadius } from './supportTheme';

/**
 * The assistant's live turn: thinking, then answering, in one container.
 *
 * This is section 8.4, and the reason it is a single component rather than a
 * thinking view swapped for a message view is that a swap is exactly what the
 * PRD rules out. Two components cannot morph into each other — one unmounts and
 * the other appears, and the eye reads that as the app changing its mind. Here
 * the dots gather toward the centre (`collapse` 0 to 1) while the same container
 * expands out of that point, so there is one object throughout.
 *
 * The trigger is the first real token, not a timer: `content` becoming non-empty
 * is the backend forwarding Groq's first delta. That is what makes the morph
 * honest — it happens when the answer actually starts, and if generation stalls
 * the dots keep waving rather than opening an empty box.
 */

export type AIPhase = 'thinking' | 'streaming' | 'complete';

type Props = {
  content: string;
  phase: AIPhase;
};

export default function AIMessage({ content, phase }: Props) {
  const reduced = useReducedMotion();
  const collapse = useSharedValue(0);
  const open = useSharedValue(0);

  const answering = content.length > 0;

  useEffect(() => {
    if (!answering) {
      collapse.value = 0;
      open.value = 0;
      return;
    }
    if (reduced) {
      // Reduce Motion keeps the state change and drops the travel: a short
      // cross-fade says the same thing without the scale and the slide.
      collapse.value = withTiming(1, { duration: 140 });
      open.value = withTiming(1, { duration: 180 });
      return;
    }
    collapse.value = withTiming(1, {
      duration: 200,
      easing: Easing.in(Easing.quad),
    });
    open.value = withTiming(1, {
      duration: 340,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
    });
  }, [answering, reduced, collapse, open]);

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: answering ? open.value : 1,
    transform: [
      // Expanding from the dots' compressed state rather than from nothing:
      // 0.9 is roughly where three gathered dots sit inside this container.
      { scale: answering ? 0.9 + open.value * 0.1 : 1 },
    ],
  }));

  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(200)}
      layout={reduced ? undefined : LinearTransition.duration(220)}
      style={s.row}
    >
      <View style={s.avatar}>
        <HashmiAvatar
          size={30}
          state={answering ? 'speaking' : 'thinking'}
        />
      </View>
      <View style={s.column}>
        <Text style={s.who}>Hashmi AI</Text>
        <Animated.View style={[s.bubble, bubbleStyle]}>
          {answering ? (
            <Text style={s.text}>
              {content}
              {phase === 'streaming' ? (
                // A caret rather than a spinner: it says more is coming without
                // implying the app is stuck.
                <Text style={s.caret}>▍</Text>
              ) : null}
            </Text>
          ) : (
            <AIThinkingIndicator collapse={collapse} />
          )}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  avatar: { paddingTop: 18 },
  column: { flexShrink: 1, maxWidth: '82%', gap: 3 },
  who: { fontSize: 11, fontWeight: '700', color: support.muted, marginLeft: 2 },
  bubble: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: supportRadius.bubble,
    borderTopLeftRadius: 6,
    backgroundColor: support.aiSurface,
    borderWidth: 1,
    borderColor: support.aiBorder,
  },
  text: {
    fontSize: 14.5,
    lineHeight: 21,
    color: support.ink,
    writingDirection: 'auto',
  },
  caret: { color: support.accent, fontSize: 13 },
});
