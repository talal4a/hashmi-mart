import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pause, Play } from 'lucide-react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import PressableScale from '../ui/PressableScale';
import { formatDuration } from '../../hooks/useVoiceRecorder';
import type { SupportMessage } from '../../types/support';
import { support, supportRadius } from './supportTheme';

/**
 * A sent voice note: play control, a static trace of the recording, and — once
 * the backend has heard it — the transcript underneath.
 *
 * The waveform here is deliberately *not* the live meter. A recording that has
 * already been sent is not moving, and animating it would say otherwise; what
 * the user needs from this card is proof of what they sent and how long it was.
 * The live component (`VoiceWaveform`) belongs to the recorder tray, and the
 * transition between the two is the caller's job — section 8.5 asks for the
 * meter to compress into this card rather than be swapped for it.
 *
 * The transcript appears when it arrives and not before. Section 14 forbids
 * fabricating one, which in UI terms means there is no placeholder text here:
 * either the words are real or the row is absent.
 */

/** A fixed silhouette. Recognisably a voice note, not a claim about the audio. */
const TRACE = [
  0.3, 0.55, 0.85, 0.6, 0.4, 0.75, 1, 0.7, 0.45, 0.3, 0.6, 0.9, 0.65, 0.4, 0.55,
  0.35, 0.7, 0.5, 0.3, 0.45,
];

export default function VoiceMessage({ message }: { message: SupportMessage }) {
  const reduced = useReducedMotion();
  const player = useAudioPlayer(message.audioUri ?? null);
  const playback = useAudioPlayerStatus(player);
  const [failed, setFailed] = useState(false);

  // The player does not rewind itself, so a second tap on a finished note would
  // otherwise do nothing at all.
  useEffect(() => {
    if (playback.didJustFinish) player.seekTo(0).catch(() => {});
  }, [playback.didJustFinish, player]);

  const toggle = () => {
    try {
      if (playback.playing) player.pause();
      else player.play();
    } catch {
      // A cache file the OS reclaimed. The transcript is still the useful part
      // of this card, so the row degrades rather than erroring.
      setFailed(true);
    }
  };

  const progress = playback.duration > 0 ? playback.currentTime / playback.duration : 0;

  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(220)}
      style={s.card}
    >
      <View style={s.row}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={playback.playing ? 'Pause voice message' : 'Play voice message'}
          onPress={toggle}
          disabled={failed}
          scaleTo={0.9}
          style={[s.play, failed && s.playDisabled]}
        >
          {playback.playing ? (
            <Pause size={14} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
          )}
        </PressableScale>

        <View style={s.trace} accessible={false}>
          {TRACE.map((level, index) => (
            <View
              key={index}
              style={{
                width: 2.5,
                height: Math.max(4, level * 24),
                borderRadius: 2,
                // Played-through bars stay solid; the rest fade back. One
                // position readout, no separate progress bar to keep in sync.
                backgroundColor:
                  index / TRACE.length <= progress ? '#FFFFFF' : '#FFFFFF66',
              }}
            />
          ))}
        </View>

        <Text style={s.duration}>
          {formatDuration(
            playback.playing && playback.duration > 0
              ? playback.currentTime * 1000
              : (message.durationMs ?? playback.duration * 1000),
          )}
        </Text>
      </View>

      {message.transcript ? (
        <Text style={s.transcript}>{message.transcript}</Text>
      ) : message.status === 'transcribing' ? (
        <Text style={s.pending}>Transcribing…</Text>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    minWidth: 210,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: supportRadius.bubble,
    borderTopRightRadius: 6,
    backgroundColor: support.userSurface,
    gap: 7,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  play: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
  transcript: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#FFFFFF',
    writingDirection: 'auto',
  },
  pending: { fontSize: 11.5, color: '#FFFFFFAA', fontStyle: 'italic' },
});
