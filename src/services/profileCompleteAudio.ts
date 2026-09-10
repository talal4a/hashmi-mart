import { createAudioPlayer, preload, type AudioPlayer } from 'expo-audio';

// Resolves the local bundled sound asset
const SOUND_SOURCE = require('../../assets/audio/profile-complete.wav');

let cachedPlayer: AudioPlayer | null = null;
let isPreloading = false;

/**
 * Preloads the Complete Profile celebration sound asset into memory.
 * Safe to call at module or screen mount time.
 */
export async function preloadProfileCompleteSound(): Promise<void> {
  if (cachedPlayer || isPreloading) return;
  isPreloading = true;
  try {
    if (typeof preload === 'function') {
      await preload(SOUND_SOURCE);
    }
    if (!cachedPlayer && typeof createAudioPlayer === 'function') {
      cachedPlayer = createAudioPlayer(SOUND_SOURCE);
    }
  } catch (error) {
    // Non-fatal: playback will fall back to lazy creation or fail silently
    console.warn('Could not preload profile-complete sound:', error);
  } finally {
    isPreloading = false;
  }
}

/**
 * Plays the Complete Profile celebration sound.
 *
 * Requirements:
 * - Must play ONLY after Firestore saving succeeds.
 * - Reuses single player instance to avoid native leaks.
 * - Fire-and-forget: audio errors or missing devices must NEVER block navigation.
 */
export function playProfileCompleteSound(): void {
  try {
    if (!cachedPlayer && typeof createAudioPlayer === 'function') {
      cachedPlayer = createAudioPlayer(SOUND_SOURCE);
    }

    if (cachedPlayer) {
      // Seek to start if already played once
      if (typeof cachedPlayer.seekTo === 'function') {
        void cachedPlayer.seekTo(0).catch(() => {});
      }
      cachedPlayer.play();
    }
  } catch (error) {
    console.warn('Failed to play profile-complete sound:', error);
  }
}

/**
 * Releases native audio resources. Safe to invoke on screen unmount.
 */
export function releaseProfileCompleteSound(): void {
  try {
    if (cachedPlayer) {
      if (typeof cachedPlayer.release === 'function') {
        cachedPlayer.release();
      }
      cachedPlayer = null;
    }
  } catch (error) {
    console.warn('Failed to release profile-complete sound player:', error);
  }
}
