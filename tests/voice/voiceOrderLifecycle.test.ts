import { act, renderHook } from '@testing-library/react-native';
import useVoiceOrder from '../../src/hooks/useVoiceOrder';
import { transcribeOrder, parseOrder } from '../../src/services/voiceOrder';

jest.mock('../../src/services/voiceOrder', () => ({
  transcribeOrder: jest.fn(), parseOrder: jest.fn(),
  newVoiceOrderId: jest.fn(), submitVoiceOrder: jest.fn(),
  uploadVoiceRecording: jest.fn(),
}));
jest.mock('../../src/services/supportService', () => ({
  SupportError: class extends Error {},
  supportErrorMessage: () => 'Please try again',
}));

const recording = { uri: 'file:///order.m4a', mimeType: 'audio/m4a', durationMs: 3000 };

test('finishes transcription after intervening renders and can process another order', async () => {
  let finish!: (text: string) => void;
  jest.mocked(transcribeOrder).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  jest.mocked(parseOrder).mockResolvedValue({ items: [] });
  const { result, rerender } = await renderHook(() => useVoiceOrder());
  let pending!: Promise<void>;
  await act(() => { pending = result.current.interpret(recording); });
  expect(result.current.stage).toBe('transcribing');
  await rerender({});
  await act(async () => { finish('two milk'); await pending; });
  expect(result.current.stage).toBe('review');
  expect(result.current.transcript).toBe('two milk');
  await act(() => result.current.reset());
  jest.mocked(transcribeOrder).mockResolvedValue('bread');
  await act(async () => { await result.current.interpret(recording); });
  expect(result.current.stage).toBe('review');
  expect(result.current.transcript).toBe('bread');
});

test('does not continue parsing when transcription completes after unmount', async () => {
  let finish!: (text: string) => void;
  jest.mocked(transcribeOrder).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result, unmount } = await renderHook(() => useVoiceOrder());
  let pending!: Promise<void>;
  await act(() => { pending = result.current.interpret(recording); });
  await unmount();
  await act(async () => { finish('milk'); await pending; });
  expect(parseOrder).not.toHaveBeenCalled();
});

test('a completed old recording cannot replace a new recording', async () => {
  let finishOld!: (text: string) => void;
  jest.mocked(transcribeOrder)
    .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce('I need tomatoes');
  const { result } = await renderHook(() => useVoiceOrder());
  let oldAttempt!: Promise<void>;
  await act(() => { oldAttempt = result.current.interpret(recording); });
  await act(async () => {
    await result.current.interpret({ ...recording, uri: 'file:///new-order.m4a' });
  });
  await act(async () => { finishOld('I need bananas'); await oldAttempt; });
  expect(result.current.transcript).toBe('I need tomatoes');
  expect(result.current.addable.map(match => match.productId)).toEqual(['tomato']);
  expect(result.current.recording?.uri).toBe('file:///new-order.m4a');
});

test('reset prevents a pending response from reopening the old review', async () => {
  let finish!: (text: string) => void;
  jest.mocked(transcribeOrder).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { result } = await renderHook(() => useVoiceOrder());
  let pending!: Promise<void>;
  await act(() => { pending = result.current.interpret(recording); });
  await act(() => result.current.reset());
  await act(async () => { finish('I need bananas'); await pending; });
  expect(result.current.stage).toBe('idle');
  expect(result.current.hasRecording).toBe(false);
});
