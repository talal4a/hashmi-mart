import { setAudioModeAsync } from 'expo-audio';

// Serialize audio-mode changes across short-lived owners. Only opaque tokens
// live here; native recorder/player objects always belong to their components.
let owner: symbol | null = null;
let pending: Promise<unknown> = Promise.resolve();
function configure(expected: symbol | null, allowsRecording: boolean) {
  const operation = pending
    .catch(() => {})
    .then(async () => {
      if (owner !== expected) return false;
      await setAudioModeAsync({
        allowsRecording,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });
      return owner === expected;
    });
  pending = operation.catch(() => {});
  return operation;
}
export function acquireVoiceSession(token: symbol, recording: boolean) {
  owner = token;
  return configure(token, recording);
}
export function releaseVoiceSession(token: symbol) {
  if (owner !== token) return Promise.resolve(false);
  owner = null;
  return configure(null, false);
}
