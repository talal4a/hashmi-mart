import { useCallback, useEffect, useRef, useState } from 'react';
import { File } from 'expo-file-system';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useSharedValue } from 'react-native-reanimated';
import { WAVEFORM_BARS } from '../components/voice/VoiceWaveform';

/**
 * One recorder for the whole app.
 *
 * Voice Order and AI Support both need a microphone, a level meter and a file at
 * the end, and PRD section 9 is explicit that they must not each grow their own.
 * Everything specific to *support* — what happens to the file, which backend
 * transcribes it — stays out of here; this hook's entire contract is "hold the
 * mic open and hand back a recording".
 */

/** How often levels are sampled. Fast enough to look live, slow enough to be free. */
const SAMPLE_MS = 90;

/** A support question that runs past this is a monologue; the backend caps it too. */
export const MAX_RECORDING_MS = 120_000;

export type Recording = {
  uri: string;
  durationMs: number;
  mimeType: string;
};

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'denied' | 'error';

/**
 * Metering arrives in dBFS: 0 is clipping, -160 is silence, and speech sits
 * somewhere around -30. Mapping the full range linearly would leave every bar
 * flat, so the floor is lifted to -50 and the result curved — which is roughly
 * how loudness is perceived anyway, and is what makes an ordinary voice fill the
 * meter instead of nudging it.
 */
function levelFromMetering(db: number | undefined): number {
  if (db == null || !Number.isFinite(db)) return 0;
  const FLOOR = -50;
  const normalised = Math.max(0, Math.min(1, (db - FLOOR) / -FLOOR));
  return Math.pow(normalised, 0.6);
}

const OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  // The whole point of the waveform. Without this, `metering` is undefined and
  // the meter silently falls back to a flat line.
  isMeteringEnabled: true,
  // Mono at a speech sample rate: a third of the bytes for no loss the
  // transcription model can hear, and the payload goes over a callable.
  numberOfChannels: 1,
  sampleRate: 22050,
  bitRate: 64000,
} as const;

export default function useVoiceRecorder() {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, SAMPLE_MS);
  const [status, setStatus] = useState<RecorderStatus>('idle');

  /** The rolling level history the waveform reads. Newest sample is last. */
  const levels = useSharedValue<number[]>(new Array(WAVEFORM_BARS).fill(0));
  const startedAt = useRef(0);

  // Pushing on the JS thread and assigning a fresh array is deliberate: mutating
  // `levels.value` in place does not notify Reanimated, so the meter would go
  // still while the numbers underneath kept changing.
  useEffect(() => {
    if (!state.isRecording) return;
    const next = levels.value.slice(1);
    next.push(levelFromMetering(state.metering));
    levels.value = next;
  }, [state.metering, state.isRecording, levels]);

  const durationMs = state.isRecording ? state.durationMillis : 0;

  // A recording nobody stopped is a recording that fills the disk. The backend
  // rejects oversized audio anyway, so stopping here is the kinder half of the
  // same rule.
  const overrun = state.isRecording && durationMs >= MAX_RECORDING_MS;

  const start = useCallback(async (): Promise<boolean> => {
    setStatus('requesting');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setStatus('denied');
        return false;
      }
      // iOS records at a whisper unless the session is switched to a recording
      // category first; this is the line whose absence looks like a broken
      // microphone rather than a configuration problem.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync(OPTIONS);
      recorder.record();
      levels.value = new Array(WAVEFORM_BARS).fill(0);
      startedAt.current = Date.now();
      setStatus('recording');
      return true;
    } catch {
      setStatus('error');
      return false;
    }
  }, [recorder, levels]);

  /** Stops and returns the file, or null if there is nothing usable. */
  const stop = useCallback(async (): Promise<Recording | null> => {
    if (status !== 'recording') return null;
    // The elapsed time is read before `stop()` because the recorder's own
    // duration is reset by it, and the card needs a length to draw with.
    const elapsed = Math.max(0, Date.now() - startedAt.current);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      setStatus('idle');
      const uri = recorder.uri;
      if (!uri) return null;
      return {
        uri,
        durationMs: elapsed,
        // The preset writes .m4a on both platforms; stated rather than sniffed
        // because the backend's allow-list has to agree with it exactly.
        mimeType: 'audio/m4a',
      };
    } catch {
      setStatus('error');
      return null;
    }
  }, [recorder, status]);

  /** Stops and throws the file away. */
  const cancel = useCallback(async () => {
    if (status !== 'recording') return;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (uri) new File(uri).delete();
    } catch {
      // A cancelled recording that could not be deleted is a stray file in the
      // cache directory, which the OS reclaims. Not worth an error state.
    } finally {
      setStatus('idle');
      levels.value = new Array(WAVEFORM_BARS).fill(0);
    }
  }, [recorder, status, levels]);

  useEffect(() => {
    if (overrun) void stop();
  }, [overrun, stop]);

  // A screen left mid-recording must not keep the microphone. This runs on
  // unmount only; `recorder.isRecording` is read rather than `status` so the
  // cleanup does not need the closure to be current.
  useEffect(
    () => () => {
      if (recorder.isRecording) recorder.stop().catch(() => {});
    },
    [recorder],
  );

  return {
    status,
    recording: status === 'recording',
    durationMs,
    levels,
    start,
    stop,
    cancel,
  };
}

/** mm:ss, which is all a voice note ever needs. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
