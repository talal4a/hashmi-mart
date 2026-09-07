import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import HashmiAvatar from './HashmiAvatar';
import { WhatsAppContinueButton, WhatsAppGlyph } from './WhatsAppButton';
import { SUPPORT_PHONE_DISPLAY } from '../../config/support';
import { support, supportRadius } from './supportTheme';

/**
 * AI hands over to a person. PRD section 8.6.
 *
 * The sequence is the message: the assistant's avatar slides aside, a WhatsApp
 * mark takes the space next to it, "Connecting you..." holds for a beat, and
 * only then does the action appear. Showing the button immediately would be
 * faster and would say something different — that the AI gave up — where the
 * pause reads as a handover between two people who work together.
 *
 * The beat is short (700ms) because it is a transition, not a fake loading
 * state; nothing is actually being connected, and pretending otherwise for two
 * seconds would be theatre. Under Reduce Motion it collapses to nothing and the
 * card renders complete.
 */

const CONNECTING_MS = 700;

export default function HandoffCard({ message }: { message?: string }) {
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(reduced);
  const shift = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    shift.value = withTiming(1, {
      duration: 420,
      easing: Easing.bezier(0.32, 0.72, 0.24, 1),
    });
    const timer = setTimeout(() => setReady(true), CONNECTING_MS);
    return () => clearTimeout(timer);
  }, [reduced, shift]);

  const aiStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -shift.value * 8 }],
  }));

  const waStyle = useAnimatedStyle(() => ({
    opacity: shift.value,
    transform: [{ scale: 0.6 + shift.value * 0.4 }, { translateX: shift.value * 8 }],
  }));

  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(240)}
      style={s.card}
    >
      <View style={s.avatars}>
        <Animated.View style={aiStyle}>
          <HashmiAvatar size={30} state="idle" />
        </Animated.View>
        <Animated.View style={[s.wa, waStyle]}>
          <WhatsAppGlyph size={16} />
        </Animated.View>
      </View>

      <View style={s.copy}>
        <Text style={s.title}>
          {ready ? 'A person can take it from here' : 'Connecting you…'}
        </Text>
        <Text style={s.detail}>
          HashmiMart support on WhatsApp · {SUPPORT_PHONE_DISPLAY}
        </Text>
      </View>

      {ready ? (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(220)}
          style={s.action}
        >
          <WhatsAppContinueButton message={message} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
    marginLeft: 38,
    borderRadius: supportRadius.card,
    backgroundColor: '#F2FBFF',
    borderWidth: 1,
    borderColor: '#D3ECF8',
  },
  avatars: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wa: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: support.whatsapp,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: support.ink },
  detail: { fontSize: 11.5, color: support.muted },
  action: {},
});
