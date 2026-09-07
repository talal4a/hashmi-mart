import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RotateCcw, TriangleAlert } from 'lucide-react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import PressableScale from '../ui/PressableScale';
import { WhatsAppContinueButton } from './WhatsAppButton';
import { support, supportRadius } from './supportTheme';

/**
 * A failed answer, and the two ways out of it.
 *
 * Section 8.7 asks for the retry to *morph back into* the thinking animation
 * rather than the error vanishing and a new one appearing. That is the
 * `retrying` prop: when the caller sets it, this card compresses toward the
 * left — where the thinking dots live — and fades, so the AI turn that replaces
 * it grows out of the same point the error shrank into.
 *
 * The text is always the friendly one from `supportErrorMessage`. Nothing from
 * Firebase or Groq reaches this component, which is section 14's requirement
 * expressed as a type: this takes a `string` somebody wrote, not an `Error`.
 */

type Props = {
  message: string;
  onRetry: () => void;
  /** Set while the retry is starting, to run the morph-back. */
  retrying?: boolean;
  /** Hidden for a "Stopped." notice, which is not a failure. */
  offerWhatsApp?: boolean;
};

export default function ErrorRetry({
  message,
  onRetry,
  retrying = false,
  offerWhatsApp = true,
}: Props) {
  const reduced = useReducedMotion();
  const shrink = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    shrink.value = withTiming(retrying ? 1 : 0, {
      duration: retrying ? 220 : 0,
      easing: Easing.in(Easing.quad),
    });
  }, [retrying, reduced, shrink]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - shrink.value,
    transform: [
      { scale: 1 - shrink.value * 0.15 },
      // Toward the avatar column, which is where the dots come back.
      { translateX: -shrink.value * 12 },
    ],
  }));

  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(200)}
      style={[s.card, style]}
    >
      <View style={s.head}>
        <TriangleAlert size={15} color={support.error} strokeWidth={2.2} />
        <Text style={s.message}>{message}</Text>
      </View>
      <View style={s.actions}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={onRetry}
          disabled={retrying}
          scaleTo={0.95}
          style={s.retry}
        >
          <RotateCcw size={14} color={support.ink} strokeWidth={2.2} />
          <Text style={s.retryText}>Try again</Text>
        </PressableScale>
        {offerWhatsApp ? (
          <View style={s.whatsapp}>
            <WhatsAppContinueButton />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    gap: 10,
    padding: 13,
    marginLeft: 38,
    borderRadius: supportRadius.card,
    backgroundColor: support.errorWash,
    borderWidth: 1,
    borderColor: '#F2CFC6',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  message: { flex: 1, fontSize: 13.5, lineHeight: 19, color: '#7A3628' },
  actions: { gap: 8 },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBD3CC',
  },
  retryText: { fontSize: 13, fontWeight: '700', color: support.ink },
  whatsapp: {},
});
