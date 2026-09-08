import { act, renderHook } from '@testing-library/react-native';
import useSupportChat from '../../src/hooks/useSupportChat';
import {
  askSupport,
  transcribeVoice,
  SupportError,
} from '../../src/services/supportService';

jest.mock('../../src/services/supportService', () => ({
  ...jest.requireActual('../../src/services/supportService'),
  askSupport: jest.fn(),
  transcribeVoice: jest.fn(),
}));
const recording = {
  uri: 'file:///tmp/note.m4a',
  durationMs: 4400,
  mimeType: 'audio/m4a',
};
beforeEach(() => {
  jest.mocked(transcribeVoice).mockResolvedValue('Mera order kahan hai?');
  jest
    .mocked(askSupport)
    .mockResolvedValue({ content: 'Order number bata dein.', handoff: false });
});

test('voice transcript reaches chat once and keeps the original playable URI', async () => {
  const { result } = await renderHook(() => useSupportChat());
  await act(async () => {
    await Promise.all([
      result.current.sendVoice(recording),
      result.current.sendVoice(recording),
    ]);
  });
  expect(transcribeVoice).toHaveBeenCalledTimes(1);
  expect(askSupport).toHaveBeenCalledTimes(1);
  expect(askSupport).toHaveBeenCalledWith(
    'Mera order kahan hai?',
    [],
    expect.any(Function),
    expect.any(AbortSignal),
  );
  expect(result.current.messages).toHaveLength(2);
  expect(result.current.messages[0]).toMatchObject({
    audioUri: recording.uri,
    transcript: 'Mera order kahan hai?',
    status: 'sent',
  });
});

test('failed upload retries the same card without duplicate messages', async () => {
  jest
    .mocked(transcribeVoice)
    .mockRejectedValueOnce(new SupportError('offline'));
  const { result } = await renderHook(() => useSupportChat());
  await act(async () => {
    await result.current.sendVoice(recording);
  });
  const id = result.current.messages[0].id;
  expect(result.current.messages[0].status).toBe('error');
  await act(async () => {
    result.current.retry(id);
  });
  expect(result.current.messages).toHaveLength(2);
  expect(result.current.messages[0].id).toBe(id);
  expect(transcribeVoice).toHaveBeenCalledTimes(2);
});

test('failed AI reply retries its transcript without uploading audio again', async () => {
  jest.mocked(askSupport).mockRejectedValueOnce(new SupportError('busy'));
  const { result } = await renderHook(() => useSupportChat());
  await act(async () => {
    await result.current.sendVoice(recording);
  });
  await act(async () => {
    result.current.retry();
  });
  expect(transcribeVoice).toHaveBeenCalledTimes(1);
  expect(askSupport).toHaveBeenCalledTimes(2);
  expect(result.current.messages).toHaveLength(2);
});

test('Stop aborts transcription and allows retry', async () => {
  jest.mocked(transcribeVoice).mockImplementationOnce(
    (_uri, _mime, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () =>
          reject(new SupportError('aborted')),
        );
      }),
  );
  const { result } = await renderHook(() => useSupportChat());
  let pending!: Promise<void>;
  await act(async () => {
    pending = result.current.sendVoice(recording);
  });
  await act(async () => {
    result.current.stop();
    await pending;
  });
  expect(result.current.pending).toBe(false);
  expect(askSupport).not.toHaveBeenCalled();
  await act(async () => {
    result.current.retry();
  });
  expect(result.current.messages).toHaveLength(2);
});

test('delete removes the failed card and retry target', async () => {
  jest
    .mocked(transcribeVoice)
    .mockRejectedValueOnce(new SupportError('offline'));
  const { result } = await renderHook(() => useSupportChat());
  await act(async () => {
    await result.current.sendVoice(recording);
  });
  await act(async () => {
    result.current.deleteVoice(result.current.messages[0].id);
    result.current.retry();
  });
  expect(result.current.messages).toHaveLength(0);
  expect(transcribeVoice).toHaveBeenCalledTimes(1);
});

test('text history is captured before the voice note without React updater side effects', async () => {
  const { result } = await renderHook(() => useSupportChat());
  await act(async () => {
    result.current.send('Hello');
  });
  await act(async () => {
    await result.current.sendVoice(recording);
  });
  expect(jest.mocked(askSupport).mock.calls[1][1]).toEqual([
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Order number bata dein.' },
  ]);
});
