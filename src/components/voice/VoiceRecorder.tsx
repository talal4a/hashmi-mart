import { useState } from 'react';
import { Send, Trash2 } from 'lucide-react-native';
import { recorderReveal, recorderSend, recorderDismiss } from './voiceMotion';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
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
  recording?: boolean;
  busy?: boolean;
  compact?: boolean;
};

export default function VoiceRecorder({
  levels,
  durationMs,
  onCancel,
  onSend,
  recording = true,
  busy = false,
  compact = false,
}: Props) {
  const reduced = useReducedMotion();
  const [sending, setSending] = useState(false);
  if (compact) {
    return (
      <Animated.View
        entering={reduced ? undefined : recorderReveal}
        exiting={reduced ? undefined : sending ? recorderSend : recorderDismiss}
        style={[s.tray, s.compactTray]}
      >
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Cancel recording"
          disabled={busy}
          onPress={onCancel}
          style={s.iconButton}
        >
          <Trash2 size={21} color={grocery.muted} />
        </PressableScale>
        <AnimatedMic recording={recording} compact size={24} />
        <Text
          style={s.compactTimer}
          accessibilityLabel={`Recording, ${formatDuration(durationMs)}`}
        >
          {formatDuration(durationMs)}
        </Text>
        <VoiceWaveform levels={levels} height={30} />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Send voice message"
          disabled={busy}
          onPress={() => {
            setSending(true);
            onSend();
          }}
          style={[s.iconButton, s.compactSend]}
        >
          <Send size={19} color="#FFFFFF" />
        </PressableScale>
      </Animated.View>
    );
  }
  return (
    <Animated.View
      entering={reduced ? undefined : recorderReveal}
      exiting={reduced ? undefined : sending ? recorderSend : recorderDismiss}
      style={s.tray}
    >
      <View style={s.meterRow}>
        <AnimatedMic recording={recording} size={44} />
        <VoiceWaveform levels={levels} height={38} />
      </View>
      <View style={s.controls}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Cancel recording"
          disabled={busy}
          onPress={() => {
            setSending(false);
            onCancel();
          }}
          scaleTo={0.94}
          style={s.cancel}
        >
          <Text style={s.cancelText}>Cancel</Text>
        </PressableScale>
        <Text
          style={s.timer}
          accessibilityLabel={`Recording, ${formatDuration(durationMs)}`}
        >
          {formatDuration(durationMs)}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Send voice message"
          disabled={busy}
          onPress={() => {
            setSending(true);
            onSend();
          }}
          scaleTo={0.94}
          style={s.send}
        >
          <Text style={s.sendText}>{busy ? 'Finishing…' : 'Send'}</Text>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  compactTray: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactSend: { backgroundColor: grocery.blue },
  compactTimer: {
    fontSize: 13,
    color: grocery.muted,
    fontVariant: ['tabular-nums'],
  },
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
