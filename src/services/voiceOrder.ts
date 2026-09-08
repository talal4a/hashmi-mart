import { File, UploadType, type UploadResult } from 'expo-file-system';
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { CLOUDINARY_VOICE, VOICE_UPLOAD_URL } from '../config/cloudinary';
import { SUPPORT_API_URL } from '../config/backend';
import { SupportError, type SupportFailure } from './supportService';
import type { CatalogMatch } from './voiceCatalog';

/**
 * The two halves of a voice order: what the AI made of it, and the recording
 * itself.
 *
 * They are separate on purpose, and the separation is the product. AI is the
 * convenience layer and the recording is the safety layer, so nothing here
 * makes the second depend on the first: a transcript that fails, a parse that
 * comes back empty, or a Groq quota that runs out all leave the customer able
 * to send exactly what they said to the store. That path has no AI in it at
 * all.
 */

/* -------------------------------------------------------------------------- */
/* Retention                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Nothing is deleted automatically. That is a decision, not an omission.
 *
 * The document records when a recording *becomes* eligible for deletion, so the
 * data model is ready for the cleanup job that does not exist yet — but no code
 * in this app or the Worker removes anything, and the local recording is kept
 * too. Testing a voice order means being able to play back what was actually
 * sent; a recording that evaporates on a timer makes a failed order impossible
 * to diagnose.
 *
 * Turning it on later is this constant plus a scheduled Worker. Until then the
 * honest description of this system is "retention is manual".
 */
export const DELETE_RECORDINGS_AUTOMATICALLY = false;

/** How long a recording stays useful to the business, once it is resolved. */
const RETENTION_DAYS = 30;

/* -------------------------------------------------------------------------- */
/* AI                                                                         */
/* -------------------------------------------------------------------------- */

async function idToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new SupportError('unauthenticated');
  try {
    return await user.getIdToken();
  } catch {
    throw new SupportError('unauthenticated');
  }
}

function kindFromStatus(status: number): SupportFailure {
  if (status === 401) return 'unauthenticated';
  if (status === 429) return 'busy';
  if (status === 504) return 'timeout';
  return 'unavailable';
}

/** Sends the recording to Whisper, through the Worker that holds the key. */
export async function transcribeOrder(
  uri: string,
  mimeType = 'audio/m4a',
): Promise<string> {
  const token = await idToken();

  const form = new FormData();
  form.append('file', {
    uri,
    name: 'order.m4a',
    type: mimeType,
  } as unknown as Blob);

  let response: Response;
  try {
    response = await fetch(`${SUPPORT_API_URL}/voice/transcribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: form,
    });
  } catch {
    throw new SupportError('offline');
  }
  if (!response.ok) throw new SupportError(kindFromStatus(response.status));

  const data = (await response.json()) as { text?: string };
  // An empty transcript is silence, not a failure to be papered over. The
  // caller offers a re-record or sending the original.
  return typeof data.text === 'string' ? data.text.trim() : '';
}

export type ParsedItem = {
  query: string;
  quantity?: number;
  unit?: string;
  confidence?: number;
};

/** Turns a transcript into structured items. Empty is a valid answer. */
export async function parseOrder(
  transcript: string,
): Promise<{ items: ParsedItem[]; language?: string }> {
  const token = await idToken();

  let response: Response;
  try {
    response = await fetch(`${SUPPORT_API_URL}/voice/parse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ transcript }),
    });
  } catch {
    throw new SupportError('offline');
  }
  if (!response.ok) throw new SupportError(kindFromStatus(response.status));

  const data = (await response.json()) as {
    items?: ParsedItem[];
    language?: string;
  };
  return { items: data.items ?? [], language: data.language };
}

/* -------------------------------------------------------------------------- */
/* The original recording                                                     */
/* -------------------------------------------------------------------------- */

export type UploadedVoice = {
  publicId: string;
  secureUrl: string;
  bytes?: number;
  format?: string;
};

/** Long enough for a weak connection to finish a small file. */
const UPLOAD_TIMEOUT_MS = 45000;

/**
 * Sends the recording straight to Cloudinary, not through the Worker.
 *
 * Relaying audio through the edge would double the bytes and put a
 * multi-hundred-kilobyte body through a Worker whose free tier is metered in
 * milliseconds of CPU, to gain nothing: the preset already bounds format, size
 * and folder, and those bounds live in the console where a phone cannot edit
 * them. Signed uploads are the production upgrade, and the service boundary
 * here is shaped so that swap does not reach the UI.
 *
 * Native multipart via expo-file-system rather than `fetch`: Expo's winter
 * fetch rejects React Native's `{ uri, name, type }` file part outright, and
 * rebuilding the body in JS would pull the whole recording across the bridge.
 */
export async function uploadVoiceRecording(
  voiceOrderId: string,
  uri: string,
): Promise<UploadedVoice> {
  const file = new File(uri);

  const task = file.createUploadTask(VOICE_UPLOAD_URL, {
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    mimeType: 'audio/m4a',
    parameters: {
      upload_preset: CLOUDINARY_VOICE.uploadPreset,
      // Opaque, and it stays opaque. No name, phone, address or email may ever
      // appear in a public identifier — this is the whole privacy argument for
      // an unsigned preset being acceptable in V1.
      public_id: voiceOrderId,
      tags: 'voice-order',
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
  }, UPLOAD_TIMEOUT_MS);

  let result: UploadResult;
  try {
    result = await task.uploadAsync();
  } catch {
    throw new SupportError(timedOut ? 'timeout' : 'offline');
  } finally {
    clearTimeout(timer);
  }

  if (result.status < 200 || result.status >= 300) {
    throw new SupportError('unavailable');
  }

  const body = JSON.parse(result.body) as {
    public_id?: string;
    secure_url?: string;
    bytes?: number;
    format?: string;
  };
  if (!body.public_id || !body.secure_url) throw new SupportError('unavailable');

  return {
    publicId: body.public_id,
    secureUrl: body.secure_url,
    bytes: body.bytes,
    format: body.format,
  };
}

/* -------------------------------------------------------------------------- */
/* The record                                                                 */
/* -------------------------------------------------------------------------- */

export type VoiceOrderDraft = {
  audio: UploadedVoice;
  durationMs: number;
  transcript?: string;
  transcriptLanguage?: string;
  matches?: readonly CatalogMatch[];
  aiConfidence?: 'high' | 'medium' | 'low';
};

/**
 * Writes the order the store will actually work from.
 *
 * `userId` comes from the session rather than from an argument, because a
 * caller that can pass a uid is a caller that can pass someone else's.
 *
 * `retentionDeleteAfter` is written even though nothing acts on it. It is the
 * date this recording stops being needed, recorded now while the context is
 * here, so the cleanup job that arrives later has something to select on and
 * does not have to guess from `createdAt`.
 */
export async function submitVoiceOrder(
  draft: VoiceOrderDraft,
): Promise<{ id: string }> {
  const user = auth.currentUser;
  if (!user) throw new SupportError('unauthenticated');

  const deleteAfter = new Date();
  deleteAfter.setDate(deleteAfter.getDate() + RETENTION_DAYS);

  const created = await addDoc(collection(db, 'voiceOrders'), {
    userId: user.uid,
    status: 'pending_review',
    audio: {
      publicId: draft.audio.publicId,
      secureUrl: draft.audio.secureUrl,
      resourceType: 'video',
      format: draft.audio.format ?? 'm4a',
      durationMs: draft.durationMs,
      ...(draft.audio.bytes ? { bytes: draft.audio.bytes } : null),
    },
    ...(draft.transcript ? { transcript: draft.transcript } : null),
    ...(draft.transcriptLanguage
      ? { transcriptLanguage: draft.transcriptLanguage }
      : null),
    ...(draft.matches?.length
      ? {
          aiDetectedItems: draft.matches.map(match => ({
            query: match.query,
            ...(match.quantity ? { quantity: match.quantity } : null),
            ...(match.unit ? { unit: match.unit } : null),
            ...(match.productId ? { productId: match.productId } : null),
            confidence: match.confidence,
          })),
        }
      : null),
    ...(draft.aiConfidence ? { aiConfidence: draft.aiConfidence } : null),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    retentionDeleteAfter: Timestamp.fromDate(deleteAfter),
  });

  return { id: created.id };
}

/** Opaque, and short enough to read back over the phone. */
export function newVoiceOrderId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `vo_${Date.now().toString(36)}${random}`;
}
