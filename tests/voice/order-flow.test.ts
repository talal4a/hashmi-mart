import { renderHook, act, waitFor } from '@testing-library/react-native';
import useVoiceOrder from '../../src/hooks/useVoiceOrder';
import { SupportError } from '../../src/services/supportService';
import * as service from '../../src/services/voiceOrder';

jest.mock('../../src/services/voiceOrder', () => ({
  transcribeOrder: jest.fn(),
  parseOrder: jest.fn(),
  uploadVoiceRecording: jest.fn(),
  submitVoiceOrder: jest.fn(),
  newVoiceOrderId: () => 'vo_test',
}));

const recording = { uri: 'file:///order.m4a', durationMs: 4200, mimeType: 'audio/m4a' };

const mocked = service as jest.Mocked<typeof service>;

/**
 * The hybrid promise, tested where it actually matters.
 *
 * The design says AI is the convenience layer and the recording is the safety
 * layer. That is only true if the safety layer is reachable when the
 * convenience layer is broken — so these check the failure paths rather than
 * the happy one: a dead transcription, an empty parse, an exhausted quota. In
 * every case the customer must still be able to send what they said.
 */

describe('voice order', () => {
  it('interprets a recording into matched items', async () => {
    mocked.transcribeOrder.mockResolvedValue('do kilo tamatar aur teen kela');
    mocked.parseOrder.mockResolvedValue({
      items: [
        { query: 'tamatar', quantity: 2 },
        { query: 'kela', quantity: 3 },
      ],
    });

    const { result } = await renderHook(() => useVoiceOrder());
    await act(async () => {
      await result.current.interpret(recording);
    });

    await waitFor(() => expect(result.current.stage).toBe('review'));
    expect(result.current.matches).toHaveLength(2);
    expect(result.current.matches[0].productId).toBe('tomato');
    expect(result.current.confidence).toBe('high');
  });

  it('keeps the recording sendable when transcription dies', async () => {
    mocked.transcribeOrder.mockRejectedValue(new SupportError('busy'));

    const { result } = await renderHook(() => useVoiceOrder());
    await act(async () => {
      await result.current.interpret(recording);
    });

    // The whole point of the hybrid: Groq being out of quota is not an
    // ordering failure, it is the moment the fallback exists for.
    await waitFor(() => expect(result.current.stage).toBe('review'));
    expect(result.current.hasRecording).toBe(true);
    expect(result.current.error).toBeTruthy();
  });

  it('keeps the transcript when the parse fails', async () => {
    mocked.transcribeOrder.mockResolvedValue('do kilo tamatar');
    mocked.parseOrder.mockRejectedValue(new SupportError('unavailable'));

    const { result } = await renderHook(() => useVoiceOrder());
    await act(async () => {
      await result.current.interpret(recording);
    });

    // Transcribe and parse are separate calls precisely so this is possible:
    // the customer still sees what was heard.
    await waitFor(() => expect(result.current.stage).toBe('review'));
    expect(result.current.transcript).toBe('do kilo tamatar');
    expect(result.current.matches).toHaveLength(0);
  });

  it('does not invent items from silence', async () => {
    mocked.transcribeOrder.mockResolvedValue('');

    const { result } = await renderHook(() => useVoiceOrder());
    await act(async () => {
      await result.current.interpret(recording);
    });

    await waitFor(() => expect(result.current.stage).toBe('review'));
    expect(result.current.matches).toHaveLength(0);
    expect(result.current.transcript).toBe('');
  });

  it('sends the original to the store with no AI at all', async () => {
    mocked.transcribeOrder.mockRejectedValue(new SupportError('busy'));
    mocked.uploadVoiceRecording.mockResolvedValue({
      publicId: 'vo_test',
      secureUrl: 'https://res.cloudinary.com/x/video/upload/vo_test.m4a',
    });
    mocked.submitVoiceOrder.mockResolvedValue({ id: 'abc123' });

    const { result } = await renderHook(() => useVoiceOrder());
    await act(async () => {
      await result.current.interpret(recording);
    });
    await act(async () => {
      await result.current.sendToStore();
    });

    await waitFor(() => expect(result.current.stage).toBe('sent'));
    expect(result.current.reference).toBe('abc123');
    expect(mocked.uploadVoiceRecording).toHaveBeenCalledWith(
      'vo_test',
      recording.uri,
    );
  });

  it('holds the recording when the upload fails, so Try again resends', async () => {
    mocked.transcribeOrder.mockResolvedValue('tamatar');
    mocked.parseOrder.mockResolvedValue({ items: [{ query: 'tamatar' }] });
    mocked.uploadVoiceRecording.mockRejectedValue(new SupportError('offline'));

    const { result } = await renderHook(() => useVoiceOrder());
    await act(async () => {
      await result.current.interpret(recording);
    });
    await act(async () => {
      await result.current.sendToStore();
    });

    // Losing an upload must never cost the customer their words.
    await waitFor(() => expect(result.current.stage).toBe('review'));
    expect(result.current.hasRecording).toBe(true);
    expect(result.current.error).toBeTruthy();
  });

  it('offers only matched items to the cart', async () => {
    mocked.transcribeOrder.mockResolvedValue('tamatar aur washing machine');
    mocked.parseOrder.mockResolvedValue({
      items: [{ query: 'tamatar' }, { query: 'washing machine' }],
    });

    const { result } = await renderHook(() => useVoiceOrder());
    await act(async () => {
      await result.current.interpret(recording);
    });

    await waitFor(() => expect(result.current.stage).toBe('review'));
    // Both are shown — an item dropped from view is how an order arrives short
    // — but only the real one can be added.
    expect(result.current.matches).toHaveLength(2);
    expect(result.current.addable).toHaveLength(1);
    expect(result.current.confidence).toBe('low');
  });
});
