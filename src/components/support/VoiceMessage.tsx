import { StyleSheet, Text, View } from 'react-native';
import { RotateCcw, Trash2 } from 'lucide-react-native';
import { useVoicePlayback } from './VoicePlaybackContext';
import Animated, {
  FadeInUp,
  FadeIn,
  useReducedMotion,
} from 'react-native-reanimated';
import PressableScale from '../ui/PressableScale';
import VoiceNotePlayer, {
  type PlayerTone,
} from '../voice/VoiceNotePlayer';
import type { SupportMessage } from '../../types/support';
import { support, supportRadius } from './supportTheme';

/**
 * A voice note shows playback controls, waveform and duration. Transcription
 * stays in the chat data for the AI request; it is not displayed in the bubble.
 * Processing and failure states keep their feedback and recovery controls.
 *
 * The playing itself lives in `VoiceNotePlayer`, shared with checkout — the
 * audio lifecycle has been wrong once already, and one copy of it is one place
 * for that to be fixed.
 */

/** On the user's coloured bubble, everything is drawn in white. */
const TONE: PlayerTone = {
  control: '#FFFFFF33',
  icon: '#FFFFFF',
  waveOn: '#FFFFFF',
  waveOff: '#FFFFFF66',
  text: '#FFFFFFCC',
  status: '#FFFFFFAA',
};

export default function VoiceMessage({
  message,
  onRetry,
  onDelete,
  busy,
}: {
  message: SupportMessage;
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
  busy?: boolean;
}) {
  const { activeId, blocked, select } = useVoicePlayback();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduced
          ? FadeIn.duration(140)
          : FadeInUp.duration(240).springify().damping(24)
      }
      style={s.card}
    >
      <VoiceNotePlayer
        uri={message.audioUri!}
        durationMs={message.durationMs ?? 0}
        tone={TONE}
        label="voice message"
        active={activeId === message.id}
        disabled={blocked}
        onActivate={() => select(message.id)}
      />
      {message.status === 'transcribing' ? (
        <Text style={s.pending}>Listening to your note…</Text>
      ) : null}
      {message.status === 'error' ? (
        <View style={s.recoveryActions}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Retry voice message"
            accessibilityState={{ disabled: !!busy }}
            style={[s.recoveryButton, s.retryButton, busy && s.playDisabled]}
            scaleTo={0.92}
            hitSlop={8}
            disabled={busy}
            onPress={() => onRetry?.(message.id)}
          >
            <RotateCcw size={15} color="#FFFFFF" strokeWidth={2.2} />
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Delete voice message"
            accessibilityState={{ disabled: !!busy }}
            style={[s.recoveryButton, s.deleteButton, busy && s.playDisabled]}
            scaleTo={0.92}
            hitSlop={8}
            disabled={busy}
            onPress={() => {
              select(null);
              onDelete?.(message.id);
            }}
          >
            <Trash2 size={15} color="#DC2626" strokeWidth={2} />
          </PressableScale>
        </View>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    minWidth: 240,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: supportRadius.bubble,
    borderTopRightRadius: 6,
    backgroundColor: support.userSurface,
    gap: 7,
  },
  playDisabled: { opacity: 0.45 },
  recoveryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    paddingTop: 2,
  },
  recoveryButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  retryButton: { backgroundColor: '#FFFFFF26' },
  deleteButton: { backgroundColor: '#FFF1F2' },
  pending: { fontSize: 11.5, color: '#FFFFFFAA', fontStyle: 'italic' },
});
