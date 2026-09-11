import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acquireVoiceSession,
  releaseVoiceSession,
} from '../services/voiceAudioSession';
import { File } from 'expo-file-system';
import { AppState } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  useAudioRecorder,
  type RecorderState,
} from 'expo-audio';
import { useSharedValue } from 'react-native-reanimated';
import { WAVEFORM_BARS } from '../components/voice/VoiceWaveform';

const SAMPLE_MS = 150;

export const MAX_RECORDING_MS = 120_000;

export type Recording = {
  uri: string;
  durationMs: number;
  mimeType: string;
};

export type RecorderStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'stopping'
  | 'ready'
  | 'denied'
  | 'error';

function levelFromMetering(db: number | undefined): number {
  if (db == null || !Number.isFinite(db)) return 0;
  const FLOOR = -50;
  const normalised = Math.max(0, Math.min(1, (db - FLOOR) / -FLOOR));
  return Math.pow(normalised, 0.6);
}

const OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,

  isMeteringEnabled: true,

  numberOfChannels: 1,
  sampleRate: 22050,
  bitRate: 64000,
} as const;

export default function useVoiceRecorder() {
  const recorder = useAudioRecorder(OPTIONS, event => {
    if (mounted.current && (event.hasError || event.mediaServicesDidReset)) {
      recordingActive.current = false;
      setStatus('error');
      void releaseVoiceSession(session.current).catch(() => {});
    }
  });
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    canRecord: false,
    durationMillis: 0,
    mediaServicesDidReset: false,
    url: null,
  });
  const [status, setStatus] = useState<RecorderStatus>('idle');

  const levels = useSharedValue<number[]>(new Array(WAVEFORM_BARS).fill(0));
  const startedAt = useRef(0);
  const ready = useRef<Recording | null>(null);
  const mounted = useRef(true);
  const session = useRef(Symbol('voice-recorder'));
  const operationInProgress = useRef(false);
  const recordingActive = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Expo owns disposal. Never read or stop the native recorder here.
      void releaseVoiceSession(session.current).catch(() => {});
    };
  }, []);

  // Expo's status hook reads native state during every render and polls even
  // while idle. Keep one guarded poller only for an active recording.
  useEffect(() => {
    if (status !== 'recording') return;
    const timer = setInterval(() => {
      if (!mounted.current || operationInProgress.current) return;
      try {
        setState(recorder.getStatus());
      } catch {
        clearInterval(timer);
        recordingActive.current = false;
        setStatus('error');
      }
    }, SAMPLE_MS);
    return () => clearInterval(timer);
  }, [recorder, status]);

  useEffect(() => {
    if (!state.isRecording) return;
    const next = levels.value.slice(1);
    next.push(levelFromMetering(state.metering));
    levels.value = next;
  }, [state.metering, state.isRecording, levels]);

  const durationMs =
    ready.current?.durationMs ??
    (status === 'recording' || status === 'stopping'
      ? state.durationMillis
      : 0);

  const overrun =
    status === 'recording' &&
    state.isRecording &&
    durationMs >= MAX_RECORDING_MS;

  const start = useCallback(async (): Promise<boolean> => {
    if (
      !mounted.current ||
      operationInProgress.current ||
      recordingActive.current ||
      ready.current !== null
    )
      return false;
    operationInProgress.current = true;
    setStatus('requesting');
    try {
      const currentPermission =
        await AudioModule.getRecordingPermissionsAsync();
      const permission = currentPermission.granted
        ? currentPermission
        : await AudioModule.requestRecordingPermissionsAsync();
      if (!mounted.current) return false;
      if (!permission.granted) {
        setStatus('denied');
        return false;
      }

      if (AppState.currentState === 'background') {
        setStatus('idle');
        return false;
      }
      const acquired = await acquireVoiceSession(session.current, true);
      if (!acquired) return false;
      if (!mounted.current) {
        await releaseVoiceSession(session.current);
        return false;
      }
      await recorder.prepareToRecordAsync(OPTIONS);
      if (!mounted.current) return false;
      setState({
        isRecording: false,
        canRecord: true,
        durationMillis: 0,
        mediaServicesDidReset: false,
        url: null,
      });
      recorder.record();
      recordingActive.current = true;
      levels.value = new Array(WAVEFORM_BARS).fill(0);
      startedAt.current = Date.now();
      setStatus('recording');
      return true;
    } catch {
      if (mounted.current) setStatus('error');
      await releaseVoiceSession(session.current).catch(() => {});
      return false;
    } finally {
      operationInProgress.current = false;
    }
  }, [recorder, levels]);

  /**
   * One synchronous lock covering Send, Cancel and the duration limit.
   *
   * The important property is that a *finished* recording is never thrown away.
   * This used to bail out with `null` at two points after `await
   * recorder.stop()` — once straight after the stop and once after releasing
   * the audio session — whenever the component had unmounted in the meantime.
   * Which is the ordinary case for the fastest kind of order: say "olpers do
   * bread aik", tap Stop, close the sheet. The file was written to disk
   * perfectly, the URI existed, and this function answered `null` — so the
   * caller's `if (!result) return` ended the order there. No transcription, no
   * matching, no error, nothing to retry. The audio was on the phone the whole
   * time with nothing holding a reference to it.
   *
   * Unmounting says the UI is gone. It says nothing about whether the recording
   * is good. So the mount flag now guards only the things that touch React
   * state, and the recording is returned either way — the caller decides what
   * to do with it, and the caller outlives this component.
   */
  const finish = useCallback(
    async (discard: boolean, keep = false): Promise<Recording | null> => {
      // Already stopped and held: hand it over without touching the hardware.
      if (!operationInProgress.current && ready.current) {
        const recording = ready.current;
        ready.current = null;
        if (discard) {
          try {
            new File(recording.uri).delete();
          } catch {}
        }
        if (mounted.current) setStatus('idle');
        return discard ? null : recording;
      }
      if (operationInProgress.current || !recordingActive.current) return null;
      operationInProgress.current = true;
      if (mounted.current) setStatus('stopping');
      const elapsed = Math.max(0, Date.now() - startedAt.current);
      /**
       * Where the file is going, read while the recorder is certainly alive.
       *
       * Expo picks the output path at prepare time, so this is already correct
       * before the stop — and reading it now is what makes the read after the
       * stop optional. Unmounting releases the native recorder, and touching a
       * released shared object is its own crash; but losing a finished
       * recording because a sheet closed is the bug this all exists for. With
       * the path already in hand, neither has to happen.
       */
      let uri: string | null = null;
      try {
        uri = recorder.uri;
      } catch {
        // Nothing to fall back to yet; the read after the stop is the one that
        // matters and it is guarded too.
      }
      try {
        await recorder.stop();
        recordingActive.current = false;
        // Authoritative when it can be read. Only attempted while this
        // component is still mounted, because after that the recorder may
        // already be released — and we do not need it.
        if (mounted.current) {
          try {
            uri = recorder.uri ?? uri;
          } catch {
            // Released underneath us. The path read above still stands.
          }
        }
        // Deleted only when the customer actually discarded it. Everything
        // else keeps the file: it is the only copy of what they said.
        if (discard && uri) {
          try {
            new File(uri).delete();
          } catch {}
        }
        await releaseVoiceSession(session.current).catch(() => {});
        if (mounted.current) {
          setStatus('idle');
          if (discard) levels.value = new Array(WAVEFORM_BARS).fill(0);
        }
        if (discard) return null;
        if (!uri) throw new Error('Missing recording URI');
        const file = new File(uri);
        if (!file.exists || !file.size) throw new Error('Empty recording');
        const recording = { uri, durationMs: elapsed, mimeType: 'audio/m4a' };
        // Holding it for a later hand-off only makes sense while there is
        // still a component to hand it off from.
        if (keep && mounted.current) {
          ready.current = recording;
          setStatus('ready');
        }
        return recording;
      } catch {
        recordingActive.current = false;
        if (mounted.current) setStatus('error');
        await releaseVoiceSession(session.current).catch(() => {});
        return null;
      } finally {
        operationInProgress.current = false;
      }
    },
    [recorder, levels],
  );

  const stop = useCallback(() => finish(false), [finish]);
  const cancel = useCallback(async () => {
    await finish(true);
  }, [finish]);

  useEffect(() => {
    if (overrun) void finish(false, true);
  }, [overrun, finish]);

  return {
    status,
    recording: status === 'recording',
    hasRecording:
      status === 'recording' || status === 'stopping' || status === 'ready',
    durationMs,
    levels,
    start,
    stop,
    cancel,
  };
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
