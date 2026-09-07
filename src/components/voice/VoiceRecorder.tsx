import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import PressableScale from '../ui/PressableScale';
import { grocery, softShadow } from '../home/groceryTheme';
import { formatDuration } from '../../hooks/useVoiceRecorder';
import AnimatedMic from './AnimatedMic';
import VoiceWaveform from './VoiceWaveform';

/**
 * The recording tray: mic, live meter, elapsed time, Cancel and Send.
 *
 * Shared with Voice Order, which is why it takes callbacks rather than reaching
 * for `useVoiceRecorder` itself — Voice Order will want the same tray driving a
 * cart instead of a chat, and a component that owns the recorder cannot be
 * reused for that without owning what happens to the file too.
 *
 * Cancel and Send are far apart and differently weighted on purpose. This is the
 * one control in the flow where the wrong tap destroys something the user
 * cannot get back by trying again.
 */

type Props = {
  levels: SharedValue<number[]>;
  durationMs: number;
  onCancel: () => void;
  onSend: () => void;
};

export default function VoiceRecorder({
  levels,
  durationMs,
  onCancel,
  onSend,
}: Props) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(180)}
      exiting={reduced ? undefined : FadeOut.duration(140)}
      style={s.tray}
    >
      <View style={s.meterRow}>
        <AnimatedMic recording size={44} />
        <VoiceWaveform levels={levels} height={38} />
      </View>
      <View style={s.controls}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Cancel recording"
          onPress={onCancel}
          scaleTo={0.94}
          style={s.cancel}
        >
          <Text style={s.cancelText}>Cancel</Text>
        </PressableScale>
        <Text style={s.timer} accessibilityLabel={`Recording, ${formatDuration(durationMs)}`}>
          {formatDuration(durationMs)}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Send voice message"
          onPress={onSend}
          scaleTo={0.94}
          style={s.send}
        >
          <Text style={s.sendText}>Send</Text>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  tray: {
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCEFF8',
    ...softShadow,
  },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  controls: { flexDirection: 'row', alignItems: 'center' },
  timer: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: grocery.muted,
    fontVariant: ['tabular-nums'],
  },
  cancel: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  cancelText: { fontSize: 13, fontWeight: '600', color: grocery.muted },
  send: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: grocery.blue,
  },
  sendText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
