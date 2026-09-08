import { File, UploadType, type UploadResult } from 'expo-file-system';
import { SupportError, type SupportFailure } from './supportService';

/**
 * Posting a recording to our own backend.
 *
 * Not `fetch`. Expo's winter `fetch` rejects React Native's legacy
 * `{ uri, name, type }` FormData file part outright — "Unsupported FormDataPart
 * implementation" — so the request never leaves the device. It throws like a
 * network error, which is exactly how it was being reported: a message about
 * being offline, on a connection that was fine.
 *
 * `avatarUpload` already knew this and says so in its own comment. Two callers
 * then reimplemented the broken version anyway, which is the argument for this
 * file existing: one place that knows how to send audio, rather than three that
 * each have to remember.
 *
 * The native task streams the file from disk, so a recording's bytes never
 * cross the JS bridge.
 */

/** Long enough for a slow connection on a short clip; short enough to give up. */
const TIMEOUT_MS = 30000;

function kindFromStatus(status: number): SupportFailure {
  if (status === 401) return 'unauthenticated';
  if (status === 429) return 'busy';
  if (status === 413) return 'unavailable';
  if (status === 504) return 'timeout';
  return 'unavailable';
}

/**
 * Sends an audio file and returns the parsed JSON body.
 *
 * A failure here reports `timeout` when we gave up waiting and `offline` only
 * when the transport genuinely could not reach anything — the two were
 * previously the same message, which made a bug in this file indistinguishable
 * from a customer on a bad connection.
 */
export async function postAudio<T>(
  url: string,
  token: string,
  uri: string,
  mimeType = 'audio/m4a',
): Promise<T> {
  // A recording the recorder never finished writing, or one the OS has already
  // reclaimed, is its own failure. Sending it would surface as a network error
  // and send the customer to check their connection over a file that is not
  // there.
  let file: File;
  try {
    file = new File(uri);
    if (!file.exists || file.size === 0) throw new SupportError('missing-file');
  } catch (error) {
    throw error instanceof SupportError
      ? error
      : new SupportError('missing-file');
  }

  const task = file.createUploadTask(url, {
    uploadType: UploadType.MULTIPART,
    // The field name every one of our endpoints reads. The part carries the
    // file's own name, which is the extension Whisper reads the format from.
    fieldName: 'file',
    mimeType,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      task.cancel();
    } catch {
      // Already finished; nothing to cancel.
    }
  }, TIMEOUT_MS);

  let result: UploadResult;
  try {
    result = await task.uploadAsync();
  } catch {
    throw new SupportError(timedOut ? 'timeout' : 'offline');
  } finally {
    clearTimeout(timer);
  }

  if (result.status < 200 || result.status >= 300) {
    throw new SupportError(kindFromStatus(result.status));
  }

  try {
    return JSON.parse(result.body) as T;
  } catch {
    // A 200 that is not JSON is a backend fault, not a connectivity one.
    throw new SupportError('unavailable');
  }
}
