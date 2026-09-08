import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import VoiceMessage from '../../src/components/support/VoiceMessage';
import { VoicePlaybackProvider } from '../../src/components/support/VoicePlaybackContext';

const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn().mockResolvedValue(undefined),
};
let mockStatus = {
  isLoaded: true,
  currentTime: 0,
  duration: 4.4,
  playing: false,
  didJustFinish: false,
  isBuffering: false,
  playbackState: 'ready',
  error: null as string | null,
};
const mockDispose = jest.fn();
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => {
    require('react').useEffect(() => mockDispose, []);
    return mockPlayer;
  },
  useAudioPlayerStatus: () => mockStatus,
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  RecordingPresets: { HIGH_QUALITY: {} },
}));
jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({ exists: true, size: 100 })),
}));
const first = {
  id: '1',
  role: 'user' as const,
  content: '',
  createdAt: 0,
  audioUri: 'file:///note.m4a',
  durationMs: 4400,
};
function Cards({ enabled = true }) {
  return (
    <VoicePlaybackProvider enabled={enabled}>
      <VoiceMessage message={first} />
      <VoiceMessage message={{ ...first, id: '2' }} />
    </VoicePlaybackProvider>
  );
}
beforeEach(() => {
  mockStatus = {
    isLoaded: true,
    currentTime: 0,
    duration: 4.4,
    playing: false,
    didJustFinish: false,
    isBuffering: false,
    playbackState: 'ready',
    error: null as string | null,
  };
});

test('tap really plays; a second tap pauses even before status catches up', async () => {
  const screen = await render(<Cards />);
  await fireEvent.press(screen.getAllByLabelText('Play voice message')[0]);
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getAllByLabelText('Play voice message')[0]);
  expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
});

test('switching notes and losing focus dispose the active native player', async () => {
  const screen = await render(<Cards />);
  await fireEvent.press(screen.getAllByLabelText('Play voice message')[0]);
  await fireEvent.press(screen.getAllByLabelText('Play voice message')[1]);
  expect(mockDispose).toHaveBeenCalledTimes(1);
  await screen.rerender(<Cards enabled={false} />);
  expect(mockDispose).toHaveBeenCalledTimes(2);
});

test('replay waits for seek before calling native play again', async () => {
  const screen = await render(<Cards />);
  await fireEvent.press(screen.getAllByLabelText('Play voice message')[0]);
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(1));
  mockStatus = { ...mockStatus, didJustFinish: true, currentTime: 4.4 };
  await screen.rerender(<Cards />);
  let resolve!: () => void;
  mockPlayer.seekTo.mockReturnValueOnce(
    new Promise<void>(r => {
      resolve = r;
    }),
  );
  await fireEvent.press(screen.getAllByLabelText('Play voice message')[0]);
  await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledWith(0));
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(1));
  await act(async () => {
    resolve();
  });
  expect(mockPlayer.play).toHaveBeenCalledTimes(2);
});

test('a source that never loads shows recovery instead of silently doing nothing', async () => {
  mockStatus = { ...mockStatus, isLoaded: false };
  const screen = await render(<Cards />);
  await fireEvent.press(screen.getAllByLabelText('Play voice message')[0]);
  await act(async () => {
    jest.advanceTimersByTime(10_000);
  });
  expect(
    screen.getByText("Audio couldn't play. Tap play to retry."),
  ).toBeTruthy();
  expect(mockPlayer.play).not.toHaveBeenCalled();
});

test('native asynchronous playback errors expose recovery', async () => {
  const screen = await render(<Cards />);
  await fireEvent.press(screen.getAllByLabelText('Play voice message')[0]);
  mockStatus = { ...mockStatus, error: 'decoder failed', isLoaded: false };
  await screen.rerender(<Cards />);
  expect(
    screen.getByText("Audio couldn't play. Tap play to retry."),
  ).toBeTruthy();
  expect(screen.queryByText('decoder failed')).toBeNull();
});
