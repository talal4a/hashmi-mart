import {
  preloadProfileCompleteSound,
  playProfileCompleteSound,
  releaseProfileCompleteSound,
} from '../../src/services/profileCompleteAudio';
import * as expoAudio from 'expo-audio';

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  preload: jest.fn(),
}));

describe('profileCompleteAudio', () => {
  let mockPlayer: {
    play: jest.Mock;
    seekTo: jest.Mock;
    release: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayer = {
      play: jest.fn(),
      seekTo: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    (expoAudio.createAudioPlayer as jest.Mock).mockReturnValue(mockPlayer);
  });

  afterEach(() => {
    releaseProfileCompleteSound();
  });

  it('preloads audio without errors', async () => {
    (expoAudio.preload as jest.Mock).mockResolvedValue(undefined);
    await preloadProfileCompleteSound();
    expect(expoAudio.preload).toHaveBeenCalled();
  });

  it('handles preload failure gracefully without throwing', async () => {
    (expoAudio.preload as jest.Mock).mockRejectedValue(new Error('Audio unavailable'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(preloadProfileCompleteSound()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('plays audio and rewinds to 0 if already created', () => {
    playProfileCompleteSound();
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);

    // Call second time
    playProfileCompleteSound();
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  });

  it('handles playback failure gracefully without throwing', () => {
    mockPlayer.play.mockImplementation(() => {
      throw new Error('Playback error');
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => playProfileCompleteSound()).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('releases player on releaseProfileCompleteSound', () => {
    playProfileCompleteSound();
    expect(expoAudio.createAudioPlayer).toHaveBeenCalled();

    releaseProfileCompleteSound();
    expect(mockPlayer.release).toHaveBeenCalled();
  });
});
