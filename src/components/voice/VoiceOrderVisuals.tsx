import { memo, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Check, Mic, Square } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import PressableScale from '../ui/PressableScale';
import VoiceWaveform from './VoiceWaveform';

const C = {
  ink: '#0B2936',
  muted: '#688493',
  cyan: '#08ACE0',
  line: '#CCEAF4',
  /**
   * The one red in the app, and it is spent here.
   *
   * Red on a grocery screen normally means something is wrong, which is why
   * nothing else uses it. A record button is the exception: red-means-stop is
   * the one control convention that needs no reading at all, and someone who
   * is unsure whether the app is still listening should be able to find the
   * way out by colour alone.
   */
  stop: '#D33F3A',
};

/** A single UI-thread breath; pauses as soon as the app leaves the foreground. */
export const VoiceOrb = memo(function VoiceOrb({
  active,
}: {
  active: boolean;
}) {
  const reduced = useReducedMotion();
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  );
  const pulse = useSharedValue(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = 0;
    if (active && foreground && !reduced) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    }
    return () => cancelAnimation(pulse);
  }, [active, foreground, reduced, pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.3 + pulse.value * 0.35,
    transform: [{ scale: 1 + pulse.value * 0.1 }],
  }));
  const core = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.025 }],
  }));
  return (
    <View style={s.orbit} accessible={false}>
      <View style={s.outerRing} />
      <Animated.View style={[s.halo, halo]} />
      <Animated.View style={core}>
        <LinearGradient
          colors={['#2FD0F0', '#08ACE0', '#008CBE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.orb}
        >
          <View style={s.orbHighlight} />
          <Mic size={44} strokeWidth={1.8} color="#FFFFFF" />
        </LinearGradient>
      </Animated.View>
      <View style={s.orbitDot} />
    </View>
  );
});

/** Two minutes is the ceiling; warn while there is still time to wrap up. */
const NEARLY_UP_SECONDS = 105;

export const VoiceCapturePanel = memo(function VoiceCapturePanel({
  levels,
  seconds,
  onDone,
  onCancel,
}: {
  levels: SharedValue<number[]>;
  seconds: number;
  onDone: () => void;
  /** Throws the recording away and returns to the start, without closing. */
  onCancel?: () => void;
}) {
  const timer = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const nearlyUp = seconds >= NEARLY_UP_SECONDS;
  return (
    <View style={s.content}>
      <View style={s.center}>
        <Text style={s.headline}>Listening…</Text>
        <Text style={s.subtitle}>
          Say each item and how many. Tap the red Stop button when you finish.
        </Text>
      </View>
      <VoiceOrb active />
      <View style={s.waveCard}>
        <View style={s.liveDot} />
        <VoiceWaveform levels={levels} height={30} color={C.cyan} />
        <Text style={[s.timer, nearlyUp && s.timerWarn]}>{timer}</Text>
      </View>
      <Text style={s.example}>
        {nearlyUp
          ? 'You have 2 minutes only. Please finish soon.'
          : '“Do kele aur tamatar chahiye”'}
      </Text>
      {/*
        One word, centred, with the square that every stop button in the world
        has. Nothing to read across, nothing to decide between.
      */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Stop recording"
        onPress={onDone}
        scaleTo={0.98}
        style={s.stopButton}
      >
        <Square size={15} color="#FFFFFF" fill="#FFFFFF" />
        <Text style={s.stopLabel}>Stop</Text>
      </PressableScale>
      {onCancel ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Delete this recording and start again"
          onPress={onCancel}
          style={s.cancel}
        >
          <Text style={s.cancelLabel}>Start again</Text>
        </PressableScale>
      ) : null}
      <View style={s.footer}>
        <Mic size={12} color={C.muted} />
        <Text style={s.footnote}>We send your voice to the shop too</Text>
      </View>
    </View>
  );
});

export const VoiceWorkingPanel = memo(function VoiceWorkingPanel({
  stage,
}: {
  stage: 'preparing' | 'transcribing' | 'understanding';
}) {
  const transcribed = stage === 'understanding';
  return (
    <View style={s.working} accessibilityLiveRegion="polite">
      <VoiceOrb active={false} />
      <Text style={s.headline}>
        {stage === 'preparing'
          ? 'Getting ready…'
          : transcribed
            ? 'Looking for your items'
            : 'Hearing your words'}
      </Text>
      <Text style={s.subtitle}>
        {stage === 'preparing'
          ? 'Opening your mic'
          : 'This takes a few seconds. Please wait.'}
      </Text>
      <View style={s.progressRow}>
        <View style={[s.progressChip, s.progressDone]}>
          <Check size={13} color="#237C54" />
          <Text style={s.progressLabel}>Recorded</Text>
        </View>
        <View style={[s.progressChip, transcribed && s.progressDone]}>
          {transcribed ? (
            <Check size={13} color="#237C54" />
          ) : (
            <View style={s.smallDot} />
          )}
          <Text style={s.progressLabel}>
            {transcribed ? 'Words ready' : 'Reading'}
          </Text>
        </View>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  content: { gap: 15, paddingTop: 22 },
  center: { alignItems: 'center', gap: 7 },
  headline: {
    fontSize: 28,
    letterSpacing: -1,
    fontWeight: '800',
    color: C.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: C.muted,
    textAlign: 'center',
  },
  orbit: {
    height: 168,
    width: 168,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 1,
    borderColor: C.line,
  },
  halo: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#C5EEFA',
  },
  orb: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#84DEF4',
  },
  orbHighlight: {
    position: 'absolute',
    top: 7,
    left: 22,
    width: 67,
    height: 24,
    borderRadius: 30,
    backgroundColor: '#FFFFFF22',
    transform: [{ rotate: '-24deg' }],
  },
  orbitDot: {
    position: 'absolute',
    top: 22,
    right: 15,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#98DDB4',
    borderWidth: 2,
    borderColor: '#F2FAFD',
  },
  waveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 56,
    borderRadius: 20,
    paddingHorizontal: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0EEF3',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DF686B' },
  timer: {
    fontVariant: ['tabular-nums'],
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
    minWidth: 36,
  },
  timerWarn: { color: '#B4562F' },
  example: {
    textAlign: 'center',
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 60,
    borderRadius: 22,
    paddingHorizontal: 19,
    backgroundColor: C.stop,
  },
  stopLabel: {
    fontWeight: '800',
    fontSize: 19,
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelLabel: { color: C.muted, fontSize: 12.5, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  footnote: { fontSize: 11, color: C.muted },
  working: { alignItems: 'center', paddingVertical: 30, gap: 13 },
  progressRow: { flexDirection: 'row', gap: 9, marginTop: 10 },
  progressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#E6F5FC',
  },
  progressDone: { backgroundColor: '#E8F8EE' },
  progressLabel: { color: C.ink, fontSize: 11, fontWeight: '600' },
  smallDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.cyan },
});
