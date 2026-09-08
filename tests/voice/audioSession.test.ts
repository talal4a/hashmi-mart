import { setAudioModeAsync } from 'expo-audio';
import {
  acquireVoiceSession,
  releaseVoiceSession,
} from '../../src/services/voiceAudioSession';
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

test('late cleanup from an old recorder cannot disable the new recording session', async () => {
  const old = Symbol('old');
  const current = Symbol('current');
  await acquireVoiceSession(old, true);
  await acquireVoiceSession(current, true);
  jest.mocked(setAudioModeAsync).mockClear();
  await releaseVoiceSession(old);
  expect(setAudioModeAsync).not.toHaveBeenCalled();
  await releaseVoiceSession(current);
  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsRecording: false }),
  );
});

test('native mode changes finish in order when owners switch during an await', async () => {
  const old = Symbol('old');
  const current = Symbol('current');
  let resolve!: () => void;
  jest.mocked(setAudioModeAsync).mockReturnValueOnce(
    new Promise<void>(r => {
      resolve = r;
    }),
  );
  const first = acquireVoiceSession(old, true);
  await Promise.resolve();
  await Promise.resolve();
  const cleanup = releaseVoiceSession(old);
  const second = acquireVoiceSession(current, false);
  resolve();
  expect(await first).toBe(false);
  await cleanup;
  expect(await second).toBe(true);
  expect(setAudioModeAsync).toHaveBeenCalledTimes(2);
  await releaseVoiceSession(current);
});
