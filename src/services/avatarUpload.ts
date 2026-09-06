/**
 * Send a chosen photo to Cloudinary and get back a URL to store.
 *
 * The request is unsigned, which is the whole point: no key, no secret and no
 * signature travel with the app, so there is nothing in the APK worth extracting.
 * What stops abuse is the preset's own configuration in the console — folder,
 * formats, size cap, incoming transform — described in config/cloudinary.ts.
 *
 * The upload itself runs on expo-file-system's native network stack rather than
 * `fetch`. Expo's winter `fetch` no longer accepts React Native's legacy
 * `{ uri, name, type }` FormData file part — it rejects the whole request with
 * "Unsupported FormDataPart implementation" — and rebuilding a multipart body
 * in JS would pull a multi-megabyte photo across the bridge for nothing. The
 * native upload streams the file from disk and never puts its bytes in JS.
 *
 * Nothing here writes to Firestore. The upload happens when the user picks a
 * photo, but the URL is only committed with the rest of the form, so abandoning
 * Complete Profile leaves an unreferenced image in Cloudinary rather than a
 * half-written user document. That is the right way round: an orphan image costs
 * a few KB, while a document claiming a photo the user never confirmed is a bug
 * that shows up on every screen.
 */
import { File, UploadType, type UploadResult } from 'expo-file-system';
import { CLOUDINARY, UPLOAD_URL } from '../config/cloudinary';
import type { PickedPhoto } from './photoPicker';

/** What gets stored on the user document. */
export type UploadedPhoto = {
  /** Canonical `secure_url`, untransformed — each consumer asks for its own size. */
  url: string;
  /** So a later upload, or a cleanup job, can find this exact asset again. */
  publicId: string;
};

/** Long enough for a slow connection, short enough that a dead one gives up. */
const TIMEOUT_MS = 45000;

export class UploadError extends Error {}

/**
 * Cloudinary's own messages are aimed at whoever configured the account, not at
 * whoever is holding the phone. Two of them are worth translating precisely
 * because they mean *setup is incomplete* rather than *something went wrong*, and
 * they would otherwise be indistinguishable from a network failure.
 */
function friendly(message: string): string {
  const m = message.toLowerCase();
  // Cloudinary's wording for a missing preset varies ("Upload preset not
  // found", "Invalid preset", ...) but every variant means the same thing:
  // the console-side setup in config/cloudinary.ts was never done. Better to
  // say that plainly than to let one phrasing fall through to a connection
  // error, which sends the user hunting for a network problem that is not
  // there.
  if (m.includes('preset')) {
    return 'Photo uploads are not set up yet. Pick a character for now.';
  }
  if (m.includes('file size') || m.includes('too large')) {
    return 'That photo is too large. Try another one.';
  }
  if (m.includes('format') || m.includes('invalid image')) {
    return "That file isn't a photo we can use. Try a JPG or PNG.";
  }
  return "We couldn't upload that photo. Check your connection and try again.";
}

/**
 * `tags` carries the UID rather than `public_id` doing it.
 *
 * An unsigned upload is not allowed to overwrite an existing asset, so naming the
 * file after the user would make their *second* upload fail — the one case where
 * they are actively trying to fix their picture. Cloudinary generates a unique id
 * instead and the UID rides along as a tag, which is enough to find every asset
 * belonging to an account without giving any client the power to replace one.
 */
export async function uploadPhoto(
  uid: string,
  photo: PickedPhoto,
): Promise<UploadedPhoto> {
  // The picker hands back a local file (`file://`, or a `content://` on older
  // Android photo pickers) — either is a valid expo-file-system location.
  const file = new File(photo.uri);

  const task = file.createUploadTask(UPLOAD_URL, {
    uploadType: UploadType.MULTIPART,
    // Cloudinary expects the image on the field named `file`.
    fieldName: 'file',
    mimeType: photo.mime,
    parameters: {
      upload_preset: CLOUDINARY.uploadPreset,
      folder: CLOUDINARY.folder,
      tags: `avatar,uid_${uid}`,
    },
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      task.cancel();
    } catch {
      // Already finished; there is nothing left to cancel.
    }
  }, TIMEOUT_MS);

  let result: UploadResult;
  try {
    result = await task.uploadAsync();
  } catch (error) {
    // Keep the real cause for the log: a native upload can fail for reasons
    // that have nothing to do with the network (an unreadable file, a proxy,
    // the timeout above), and the UI copy alone cannot show that.
    console.warn(
      'Cloudinary upload failed:',
      error instanceof Error ? error.message : error,
    );
    throw new UploadError(
      timedOut
        ? 'That took too long. Check your connection and try again.'
        : "We couldn't reach the photo service. Check your connection.",
    );
  } finally {
    clearTimeout(timer);
  }

  const payload = (() => {
    try {
      return JSON.parse(result.body) as {
        secure_url?: string;
        public_id?: string;
        error?: { message?: string };
      };
    } catch {
      // A non-JSON body (proxy error page, etc.) still has a status to go on.
      return {};
    }
  })();

  if (result.status < 200 || result.status >= 300 || payload.error) {
    const raw = payload.error?.message ?? `HTTP ${result.status}`;
    console.warn('Cloudinary upload failed:', raw);
    throw new UploadError(friendly(raw));
  }

  if (!payload.secure_url || !payload.public_id) {
    throw new UploadError(friendly('unexpected response'));
  }

  return { url: payload.secure_url, publicId: payload.public_id };
}
