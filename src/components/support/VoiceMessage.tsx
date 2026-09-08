import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pause, Play, RotateCcw, Trash2 } from 'lucide-react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import AudioBoundary from '../voice/AudioBoundary';
import {
  acquireVoiceSession,
  releaseVoiceSession,
} from '../../services/voiceAudioSession';
import { File } from 'expo-file-system';
import { useVoicePlayback } from './VoicePlaybackContext';
import Animated, {
  FadeInUp,
  FadeIn,
  useReducedMotion,
} from 'react-native-reanimated';
import PressableScale from '../ui/PressableScale';
import { formatDuration } from '../../hooks/useVoiceRecorder';
import type { SupportMessage } from '../../types/support';
import { support, supportRadius } from './supportTheme';

/**
 * A voice note shows playback controls, waveform and duration. Transcription
 * stays in the chat data for the AI request; it is not displayed in the bubble.
 * Processing and failure states keep their feedback and recovery controls.
 */

/** A fixed silhouette. Recognisably a voice note, not a claim about the audio. */
const TRACE = [
  0.3, 0.55, 0.85, 0.6, 0.4, 0.75, 1, 0.7, 0.45, 0.3, 0.6, 0.9, 0.65, 0.4, 0.55,
  0.35, 0.7, 0.5, 0.3, 0.45,
];

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
      {activeId === message.id ? (
        <AudioBoundary>
          <ActiveVoicePlayer
            uri={message.audioUri!}
            durationMs={message.durationMs ?? 0}
          />
        </AudioBoundary>
      ) : (
        <VoiceControls
          playing={false}
          progress={0}
          readout={formatDuration(message.durationMs ?? 0)}
          disabled={blocked}
          onPress={() => select(message.id)}
        />
      )}
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

// Only the selected card owns native audio and subscribes to playback status.
// Blurring Support, backgrounding, or starting recording unmounts this owner.
function ActiveVoicePlayer({
  uri,
  durationMs,
}: {
  uri: string;
  durationMs: number;
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <PlaybackSession
      key={attempt}
      uri={uri}
      durationMs={durationMs}
      retry={() => setAttempt(n => n + 1)}
    />
  );
}
function PlaybackSession({
  uri,
  durationMs,
  retry,
}: {
  uri: string;
  durationMs: number;
  retry: () => void;
}) {
  const player = useAudioPlayer(uri, { updateInterval: 150 });
  const playback = useAudioPlayerStatus(player);
  const mounted = useRef(true);
  const session = useRef(Symbol('voice-player'));
  const desiredPlaying = useRef(true);
  const operation = useRef(false);
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void releaseVoiceSession(session.current).catch(() => {});
    }; // Expo disposes the player.
  }, []);
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setFailed(true);
      setLoading(false);
      desiredPlaying.current = false;
    }, 10_000);
    return () => clearTimeout(timer);
  }, [loading]);
  const play = useCallback(
    async (rewind: boolean) => {
      if (operation.current || !mounted.current) return;
      operation.current = true;
      try {
        const file = new File(uri);
        if (!file.exists || !file.size) throw new Error('missing recording');
        const acquired = await acquireVoiceSession(session.current, false);
        if (!acquired) return;
        if (!mounted.current) return;
        if (rewind) {
          await player.seekTo(0);
          if (!mounted.current) return;
        }
        if (desiredPlaying.current) player.play();
      } catch {
        if (mounted.current) {
          setFailed(true);
          setLoading(false);
        }
      } finally {
        operation.current = false;
      }
    },
    [player, uri],
  );
  useEffect(() => {
    if (
      playback.error ||
      playback.playbackState === 'error' ||
      playback.playbackState === 'failed'
    ) {
      setFailed(true);
      setLoading(false);
      return;
    }
    if (!playback.isLoaded || started.current || failed) return;
    started.current = true;
    setLoading(false);
    void play(false);
  }, [playback.isLoaded, playback.playbackState, playback.error, play, failed]);
  useEffect(() => {
    if (playback.didJustFinish) desiredPlaying.current = false;
  }, [playback.didJustFinish]);
  const toggle = () => {
    if (failed) {
      retry();
      return;
    }
    desiredPlaying.current = !desiredPlaying.current;
    if (!desiredPlaying.current) {
      try {
        player.pause();
      } catch {
        setFailed(true);
      }
    } else if (playback.isLoaded) {
      void play(
        playback.didJustFinish ||
          (playback.duration > 0 &&
            playback.currentTime >= playback.duration - 0.05),
      );
    }
  };
  const completed =
    playback.didJustFinish ||
    (playback.duration > 0 && playback.currentTime >= playback.duration);
  const progress = completed
    ? 0
    : playback.duration > 0
      ? Math.min(1, playback.currentTime / playback.duration)
      : 0;
  return (
    <View style={{ gap: 7 }}>
      <VoiceControls
        playing={playback.playing}
        progress={progress}
        readout={formatDuration(
          completed || playback.currentTime === 0
            ? durationMs
            : playback.currentTime * 1000,
        )}
        onPress={toggle}
      />
      {failed ? (
        <Text style={s.pending}>Audio couldn't play. Tap play to retry.</Text>
      ) : loading || playback.isBuffering ? (
        <Text style={s.pending}>Preparing your audio…</Text>
      ) : null}
    </View>
  );
}
function VoiceControls({
  playing,
  progress,
  readout,
  onPress,
  disabled,
}: {
  playing: boolean;
  progress: number;
  readout: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <View style={s.row}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={
          playing ? 'Pause voice message' : 'Play voice message'
        }
        onPress={onPress}
        disabled={disabled}
        scaleTo={0.92}
        style={[s.play, disabled && s.playDisabled]}
      >
        <Animated.View
          key={playing ? 'pause' : 'play'}
          entering={reduced ? undefined : FadeIn.duration(120)}
        >
          {playing ? (
            <Pause size={16} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
          )}
        </Animated.View>
      </PressableScale>
      <View style={s.trace} accessible={false} importantForAccessibility="no">
        {TRACE.map((level, index) => (
          <View
            key={index}
            style={{
              width: 2.5,
              height: Math.max(4, level * 24),
              borderRadius: 2,
              backgroundColor:
                progress > 0 && index / TRACE.length <= progress
                  ? '#FFFFFF'
                  : '#FFFFFF66',
            }}
          />
        ))}
      </View>
      <Text style={s.duration}>{readout}</Text>
    </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playDisabled: { opacity: 0.45 },
  trace: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 26,
  },
  duration: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFFCC',
    fontVariant: ['tabular-nums'],
  },
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
