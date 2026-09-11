import { act, renderHook } from '@testing-library/react-native';
import useVoiceRecorder, {
  MAX_RECORDING_MS,
} from '../../src/hooks/useVoiceRecorder';
import { AudioModule, setAudioModeAsync } from 'expo-audio';

const mockRecorder = {
  id: 'recorder-1',
  isRecording: true,
  get uri(): string | null {
    return 'file:///tmp/note.m4a';
  },
  getStatus: jest.fn(() => ({
    isRecording: true,
    durationMillis: 150,
    canRecord: true,
    metering: -20,
  })),
  prepareToRecordAsync: jest.fn(),
  record: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
};

jest.mock('expo-audio', () => ({
  AudioModule: {
    getRecordingPermissionsAsync: jest.fn(),
    requestRecordingPermissionsAsync: jest.fn(),
  },
  RecordingPresets: { HIGH_QUALITY: {} },
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioRecorder: jest.fn(() => mockRecorder),
  useAudioRecorderState: jest.fn(() => ({
    isRecording: false,
    durationMillis: 0,
    metering: undefined,
  })),
}));

const mockDelete = jest.fn();
jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({ exists: true, size: 100, delete: mockDelete })),
}));

test('unmount leaves recorder disposal to Expo without touching an unowned audio session', async () => {
  const { unmount } = await renderHook(() => useVoiceRecorder());

  await unmount();

  expect(mockRecorder.stop).not.toHaveBeenCalled();
  expect(setAudioModeAsync).not.toHaveBeenCalled();
});

beforeEach(() => {
  jest
    .mocked(AudioModule.getRecordingPermissionsAsync)
    .mockResolvedValue({ granted: false } as never);
  jest
    .mocked(AudioModule.requestRecordingPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  mockRecorder.prepareToRecordAsync.mockResolvedValue(undefined);
  mockRecorder.stop.mockResolvedValue(undefined);
});

test('rapid start and competing stop/cancel operations only reach native once', async () => {
  const { result } = await renderHook(() => useVoiceRecorder());
  await act(async () => {
    await Promise.all([result.current.start(), result.current.start()]);
  });
  expect(mockRecorder.record).toHaveBeenCalledTimes(1);
  await act(async () => {
    await Promise.all([
      result.current.stop(),
      result.current.cancel(),
      result.current.stop(),
    ]);
  });
  expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
});

test('permission resolving after unmount never prepares the released recorder', async () => {
  let resolve!: (value: any) => void;
  jest.mocked(AudioModule.requestRecordingPermissionsAsync).mockReturnValue(
    new Promise(r => {
      resolve = r;
    }),
  );
  const { result, unmount } = await renderHook(() => useVoiceRecorder());
  let pending!: Promise<boolean>;
  await act(async () => {
    pending = result.current.start();
  });
  await unmount();
  resolve({ granted: true });
  expect(await pending).toBe(false);
  expect(mockRecorder.prepareToRecordAsync).not.toHaveBeenCalled();
});

/**
 * A stop that lands after the component is gone must not touch native state.
 *
 * Unmounting releases the recorder, and reading a released shared object is its
 * own crash. But the recording must still come back — losing one because a
 * sheet closed is the bug this file is mostly about. Both hold because the
 * output path is read while the recorder is certainly alive, before the stop,
 * so the read afterwards is an upgrade rather than a requirement.
 */
test('a stop landing after unmount returns the recording without reading the released recorder', async () => {
  let resolve!: () => void;
  mockRecorder.stop.mockReturnValue(
    new Promise<void>(r => {
      resolve = r;
    }),
  );
  const { result, unmount } = await renderHook(() => useVoiceRecorder());
  await act(async () => {
    await result.current.start();
  });
  let pending!: ReturnType<typeof result.current.stop>;
  await act(async () => {
    pending = result.current.stop();
  });
  await unmount();

  const uri = jest.spyOn(mockRecorder, 'uri', 'get');
  resolve();

  expect(await pending).toEqual(
    expect.objectContaining({ uri: 'file:///tmp/note.m4a' }),
  );
  // Captured before the stop, so nothing reached for the released object.
  expect(uri).not.toHaveBeenCalled();
  uri.mockRestore();
});

test('only polls while recording and stops polling on unmount', async () => {
  const { result, unmount } = await renderHook(() => useVoiceRecorder());
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(mockRecorder.getStatus).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.start();
  });
  await act(async () => {
    jest.advanceTimersByTime(150);
  });
  expect(mockRecorder.getStatus).toHaveBeenCalledTimes(1);
  await unmount();
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(mockRecorder.getStatus).toHaveBeenCalledTimes(1);
});

test('duration limit retains the file; Send returns it without a second native stop', async () => {
  const { result } = await renderHook(() => useVoiceRecorder());
  await act(async () => {
    await result.current.start();
  });
  mockRecorder.getStatus.mockReturnValueOnce({
    isRecording: true,
    canRecord: true,
    durationMillis: MAX_RECORDING_MS,
    metering: -20,
  });
  jest.setSystemTime(Date.now() + MAX_RECORDING_MS);
  await act(async () => {
    jest.advanceTimersByTime(150);
  });
  expect(result.current.status).toBe('ready');
  let recording;
  await act(async () => {
    recording = await result.current.stop();
  });
  expect(recording).toMatchObject({ uri: 'file:///tmp/note.m4a' });
  expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe('idle');
});

test('cancel deletes its file and permits another recording', async () => {
  const { result } = await renderHook(() => useVoiceRecorder());
  await act(async () => {
    await result.current.start();
  });
  await act(async () => {
    await result.current.cancel();
  });
  expect(mockDelete).toHaveBeenCalledTimes(1);
  await act(async () => {
    await result.current.start();
  });
  expect(mockRecorder.record).toHaveBeenCalledTimes(2);
});

test('denied permission never starts the recorder', async () => {
  jest
    .mocked(AudioModule.requestRecordingPermissionsAsync)
    .mockResolvedValueOnce({ granted: false } as never);
  const { result } = await renderHook(() => useVoiceRecorder());
  await act(async () => {
    expect(await result.current.start()).toBe(false);
  });
  expect(result.current.status).toBe('denied');
  expect(mockRecorder.record).not.toHaveBeenCalled();
});

test('already granted access starts without reopening the Android permission activity', async () => {
  jest
    .mocked(AudioModule.getRecordingPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  const { result } = await renderHook(() => useVoiceRecorder());
  await act(async () => {
    expect(await result.current.start()).toBe(true);
  });
  expect(AudioModule.requestRecordingPermissionsAsync).not.toHaveBeenCalled();
  expect(mockRecorder.record).toHaveBeenCalledTimes(1);
});

/**
 * The bug this whole change exists for.
 *
 * Say something short and fast, tap Stop, close the sheet in the same second.
 * The file is written to disk perfectly — and `stop()` used to answer `null`,
 * because the component had unmounted while the native stop was in flight. The
 * caller's `if (!result) return` ended the order right there: no transcription,
 * no matching, no error, and nothing to retry. The audio sat on the phone with
 * no one holding a reference to it.
 *
 * Unmounting says the UI is gone. It says nothing about whether the recording
 * is good, and the caller that receives it outlives this component.
 */
test('a finished recording survives the component that made it', async () => {
  const view = await renderHook(() => useVoiceRecorder());

  await act(async () => {
    await view.result.current.start();
  });

  const stop = view.result.current.stop;

  // Stop and unmount in the same tick, which is exactly what tapping Stop and
  // closing the sheet does.
  let recording: Awaited<ReturnType<typeof stop>> = null;
  await act(async () => {
    const pending = stop();
    view.unmount();
    recording = await pending;
  });

  expect(recording).toEqual(
    expect.objectContaining({ uri: 'file:///tmp/note.m4a' }),
  );
  // And the file it points at is still there. Cancelling deletes; finishing
  // never does.
  expect(mockDelete).not.toHaveBeenCalled();
});
