import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pause, Play } from 'lucide-react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File } from 'expo-file-system';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import AudioBoundary from './AudioBoundary';
import PressableScale from '../ui/PressableScale';
import { formatDuration } from '../../hooks/useVoiceRecorder';
import {
  acquireVoiceSession,
  releaseVoiceSession,
} from '../../services/voiceAudioSession';

/**
 * Playing back a recording the customer made.
 *
 * Lifted out of the support chat's voice bubble so that checkout can show the
 * order the customer spoke, without a second copy of this logic. The audio
 * lifecycle here is the part that has already gone wrong once — seeking a
 * player that was never paused resumes it, so a finished note played itself
 * for ever — and a bug fixed in one copy of that is a bug still shipping in the
 * other.
 *
 * Colours are a parameter because the two homes are nothing alike: a coloured
 * chat bubble, and a white card on the checkout page.
 */

export type PlayerTone = {
  /** The play button's disc. */
  control: string;
  /** The glyph on it. */
  icon: string;
  /** Waveform, played and unplayed. */
  waveOn: string;
  waveOff: string;
  /** The running time. */
  text: string;
  /** "Preparing your audio…" and its failure twin. */
  status: string;
};

/** A fixed silhouette. Recognisably a voice note, not a claim about the audio. */
const TRACE = [
  0.3, 0.55, 0.85, 0.6, 0.4, 0.75, 1, 0.7, 0.45, 0.3, 0.6, 0.9, 0.65, 0.4, 0.55,
  0.35, 0.7, 0.5, 0.3, 0.45,
];

/**
 * The whole control, in both of its states.
 *
 * Only the active one owns native audio and subscribes to playback status, so
 * a screen full of notes is not a screen full of decoders. `active` is the
 * caller's to decide: the chat keeps one note playing at a time through its
 * own context, and checkout has only ever one to play.
 */
export default function VoiceNotePlayer({
  uri,
  durationMs,
  tone,
  active,
  onActivate,
  disabled,
  label = 'voice note',
}: {
  uri: string;
  durationMs: number;
  tone: PlayerTone;
  active: boolean;
  onActivate: () => void;
  disabled?: boolean;
  /** What the play button announces, for anyone using a screen reader. */
  label?: string;
}) {
  if (!active) {
    return (
      <VoiceNoteControls
        tone={tone}
        label={label}
        playing={false}
        progress={0}
        readout={formatDuration(durationMs)}
        disabled={disabled}
        onPress={onActivate}
      />
    );
  }
  return (
    <AudioBoundary>
      <ActiveSession
        uri={uri}
        durationMs={durationMs}
        tone={tone}
        label={label}
      />
    </AudioBoundary>
  );
}

function ActiveSession({
  uri,
  durationMs,
  tone,
  label,
}: {
  uri: string;
  durationMs: number;
  tone: PlayerTone;
  label: string;
}) {
  // A failed load is retried by rebuilding the session from scratch: the
  // player is created from the uri and cannot be reloaded in place.
  const [attempt, setAttempt] = useState(0);
  return (
    <PlaybackSession
      key={attempt}
      uri={uri}
      durationMs={durationMs}
      tone={tone}
      label={label}
      retry={() => setAttempt(n => n + 1)}
    />
  );
}

function PlaybackSession({
  uri,
  durationMs,
  tone,
  label,
  retry,
}: {
  uri: string;
  durationMs: number;
  tone: PlayerTone;
  label: string;
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

  // Latched, so a finished note stays finished. Seeking a player that was
  // never paused resumes it, which is how this used to loop for ever.
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
      <VoiceNoteControls
        tone={tone}
        label={label}
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
        <Text style={[s.status, { color: tone.status }]}>
          Audio couldn't play. Tap play to retry.
        </Text>
      ) : loading || playback.isBuffering ? (
        <Text style={[s.status, { color: tone.status }]}>
          Preparing your audio…
        </Text>
      ) : null}
    </View>
  );
}

export function VoiceNoteControls({
  playing,
  progress,
  readout,
  onPress,
  disabled,
  tone,
  label,
}: {
  playing: boolean;
  progress: number;
  readout: string;
  onPress: () => void;
  disabled?: boolean;
  tone: PlayerTone;
  label: string;
}) {
  const reduced = useReducedMotion();
  return (
    <View style={s.row}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${label}`}
        onPress={onPress}
        disabled={disabled}
        scaleTo={0.92}
        style={[
          s.play,
          { backgroundColor: tone.control },
          disabled && s.playDisabled,
        ]}
      >
        <Animated.View
          key={playing ? 'pause' : 'play'}
          entering={reduced ? undefined : FadeIn.duration(120)}
        >
          {playing ? (
            <Pause size={16} color={tone.icon} fill={tone.icon} />
          ) : (
            <Play size={16} color={tone.icon} fill={tone.icon} />
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
                  ? tone.waveOn
                  : tone.waveOff,
            }}
          />
        ))}
      </View>
      <Text style={[s.duration, { color: tone.text }]}>{readout}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontVariant: ['tabular-nums'],
  },
  status: { fontSize: 11.5, fontStyle: 'italic' },
});
