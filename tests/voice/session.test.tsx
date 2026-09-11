import { renderHook, act, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import {
  VoiceOrderProvider,
  useVoiceOrderSession,
} from '../../src/state/voiceOrderSession';
import { SupportError } from '../../src/services/supportService';
import * as service from '../../src/services/voiceOrder';

jest.mock('../../src/services/voiceOrder', () => ({
  transcribeOrder: jest.fn(),
  parseOrder: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({ exists: true, size: 8000 })),
}));

const mocked = service as jest.Mocked<typeof service>;
const fileSystem = require('expo-file-system') as { File: jest.Mock };

const recording = {
  uri: 'file:///order.m4a',
  durationMs: 1400,
  mimeType: 'audio/m4a',
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <VoiceOrderProvider>{children}</VoiceOrderProvider>
);

const open = () => renderHook(() => useVoiceOrderSession(), { wrapper });

beforeEach(() => {
  mocked.transcribeOrder.mockReset();
  mocked.parseOrder.mockReset();
  fileSystem.File.mockReturnValue({ exists: true, size: 8000 });
});

/**
 * The pipeline, now that it belongs to nobody's screen.
 *
 * The bug these exist for had no error and no crash. A customer says something
 * short and fast, taps Stop and closes the sheet in the same second — the
 * natural thing to do once you have finished speaking — and the order simply
 * produced nothing. The recording was on disk the whole time. So the first
 * thing pinned here is that the pipeline does not care what the UI is doing.
 */

describe('the voice order session', () => {
  it('keeps working when whatever handed it the recording is gone', async () => {
    // The whole bug in one test. `accept` is synchronous and the session lives
    // above the navigator, so the caller may unmount in the very next tick —
    // which is what tapping Stop and closing the sheet actually does.
    mocked.transcribeOrder.mockResolvedValue('do kilo tamatar aur aik kela');

    const view = await open();
    await act(async () => {
      view.result.current.accept(recording);
    });

    await waitFor(() => expect(view.result.current.stage).toBe('ready'));
    expect(view.result.current.addable.map(item => item.productId)).toEqual([
      'tomato',
      'banana',
    ]);
    expect(view.result.current.addable.map(item => item.quantity)).toEqual([2, 1]);
  });

  it('never asks a model about an order it already understood', async () => {
    // The free fast path, and most orders take it. Every word is in the
    // catalogue and every number is in the tables, so a model could only agree
    // with us — at the cost of a second of the customer's time and one request
    // of a small free quota.
    mocked.transcribeOrder.mockResolvedValue('do kilo tamatar aur aik kela');

    const view = await open();
    await act(async () => {
      view.result.current.accept(recording);
    });

    await waitFor(() => expect(view.result.current.stage).toBe('ready'));
    expect(mocked.parseOrder).not.toHaveBeenCalled();
  });

  it('asks the model exactly when the sentence has something left in it', async () => {
    // "tarang bara wala" is not in the catalogue and is not filler, so the
    // local read has not explained the sentence — which is precisely the case
    // a model is better at than a table of aliases.
    mocked.transcribeOrder.mockResolvedValue('do kilo tamatar aur tarang bara wala');
    mocked.parseOrder.mockResolvedValue({
      items: [{ query: 'tamatar', quantity: 2 }],
    });

    const view = await open();
    await act(async () => {
      view.result.current.accept(recording);
    });

    await waitFor(() => expect(view.result.current.stage).toBe('ready'));
    expect(mocked.parseOrder).toHaveBeenCalledTimes(1);
  });

  it('never loses a word it could not place', async () => {
    mocked.transcribeOrder.mockResolvedValue('do kilo tamatar aur tarang bara wala');
    mocked.parseOrder.mockResolvedValue({
      items: [{ query: 'tamatar', quantity: 2 }],
    });

    const view = await open();
    await act(async () => {
      view.result.current.accept(recording);
    });

    await waitFor(() => expect(view.result.current.stage).toBe('ready'));
    // Shown back, not silently dropped: an order that arrives short with
    // nothing said about it is the worst outcome this screen has.
    expect(view.result.current.unresolved.join(' ')).toContain('tarang');
  });

  it('reads a short, fast order with no model at all', async () => {
    // "bread aik" is a real order and a very small file. Nothing here may
    // depend on how long the button was held.
    mocked.transcribeOrder.mockResolvedValue('kela aik');

    const view = await open();
    await act(async () => {
      view.result.current.accept({ ...recording, durationMs: 700 });
    });

    await waitFor(() => expect(view.result.current.stage).toBe('ready'));
    expect(view.result.current.addable).toHaveLength(1);
    expect(mocked.parseOrder).not.toHaveBeenCalled();
  });

  it('keeps the audio when transcription fails, so Try again is free', async () => {
    mocked.transcribeOrder.mockRejectedValueOnce(new SupportError('unavailable'));

    const view = await open();
    await act(async () => {
      view.result.current.accept(recording);
    });
    await waitFor(() => expect(view.result.current.stage).toBe('error'));
    // The recording is still ours. Asking the customer to say it all again
    // because our upstream blinked is the rudest thing this could do.
    expect(view.result.current.recording).toEqual(recording);

    mocked.transcribeOrder.mockResolvedValue('aik kela');
    await act(async () => {
      view.result.current.retry();
    });

    await waitFor(() => expect(view.result.current.stage).toBe('ready'));
    // Same audio, second attempt — no new recording was asked for.
    expect(mocked.transcribeOrder).toHaveBeenCalledTimes(2);
    expect(mocked.transcribeOrder).toHaveBeenLastCalledWith(
      recording.uri,
      recording.mimeType,
    );
  });

  it('stands on the local read when the model dies but the words are good', async () => {
    mocked.transcribeOrder.mockResolvedValue('tamatar aur tarang bara wala');
    mocked.parseOrder.mockRejectedValue(new SupportError('busy'));

    const view = await open();
    await act(async () => {
      view.result.current.accept(recording);
    });

    // A dead parse is not a dead order. The catalogue read the sentence itself.
    await waitFor(() => expect(view.result.current.stage).toBe('ready'));
    expect(view.result.current.addable.map(item => item.productId)).toEqual([
      'tomato',
    ]);
  });

  it('calls silence silence, rather than inventing an order for it', async () => {
    mocked.transcribeOrder.mockResolvedValue('');

    const view = await open();
    await act(async () => {
      view.result.current.accept(recording);
    });

    await waitFor(() => expect(view.result.current.stage).toBe('empty'));
    expect(view.result.current.addable).toHaveLength(0);
    expect(mocked.parseOrder).not.toHaveBeenCalled();
  });

  it('rejects a mis-tap by what is on disk, not by how long it ran', async () => {
    // A fast order is a short file. The thing that distinguishes an accident
    // is that there is nothing in it.
    fileSystem.File.mockReturnValue({ exists: true, size: 120 });

    const view = await open();
    await act(async () => {
      view.result.current.accept({ ...recording, durationMs: 300 });
    });

    await waitFor(() => expect(view.result.current.stage).toBe('empty'));
    expect(mocked.transcribeOrder).not.toHaveBeenCalled();
  });

  it('lets a second recording win, without the first overwriting it', async () => {
    let releaseFirst: (text: string) => void = () => {};
    mocked.transcribeOrder
      .mockImplementationOnce(
        () => new Promise<string>(resolve => {
          releaseFirst = resolve;
        }),
      )
      .mockResolvedValueOnce('aik kela');

    const view = await open();
    await act(async () => {
      view.result.current.accept(recording);
    });
    await act(async () => {
      view.result.current.accept({ ...recording, uri: 'file:///second.m4a' });
    });
    await waitFor(() => expect(view.result.current.stage).toBe('ready'));

    // The first attempt lands late with a different order. It is not the one
    // on screen any more and must not become it.
    await act(async () => {
      releaseFirst('do kilo tamatar');
    });
    expect(view.result.current.addable.map(item => item.productId)).toEqual([
      'banana',
    ]);
  });
});
