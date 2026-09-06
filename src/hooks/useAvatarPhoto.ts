/**
 * Pick a photo, upload it, hand back a URL — as one action with one busy flag.
 *
 * The two halves are separate services because they fail for unrelated reasons
 * (no permission versus no network), but to the user they are a single tap that
 * either produces their face or explains itself. Joining them here keeps that
 * seam out of the UI, which then needs to know only three things: whether the
 * button can work at all, whether it is working now, and what to say if it didn't.
 *
 * `busy` is also the double-tap guard. An upload is the slowest thing on this
 * screen, and two of them racing would have the later response win regardless of
 * which photo the user picked second.
 *
 * Gallery or camera is the caller's choice and changes nothing below: both come
 * back as a `PickedPhoto` and go to the same upload. That is what lets the edit
 * sheet offer two rows without this hook growing a second path — or a second
 * busy flag, which is what would actually let two uploads race.
 */
import { useCallback, useRef, useState } from 'react';
import {
  photoPickerReady,
  pickPhoto,
  PhotoPickerError,
  PICKER_UNAVAILABLE,
  type PhotoSource,
} from '../services/photoPicker';
import { uploadPhoto, UploadError } from '../services/avatarUpload';
import type { UploadedPhoto } from '../services/avatarUpload';

type Result = {
  /** False when this build has no picker; the caller should say so, not hide it. */
  available: boolean;
  busy: boolean;
  error: string | null;
  pick: (source?: PhotoSource) => void;
  /** Say why the picker cannot open, without opening anything. */
  showUnavailable: () => void;
  clearError: () => void;
};

export default function useAvatarPhoto(
  uid: string,
  onUploaded: (photo: UploadedPhoto) => void,
): Result {
  // Read once per mount: installing a native module cannot happen mid-session, so
  // re-checking on every render would only cost a require() per frame.
  const available = useRef(photoPickerReady()).current;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(
    (source: PhotoSource = 'library') => {
      if (busy) {
        return;
      }
      setError(null);
      setBusy(true);
      void (async () => {
        try {
          const photo = await pickPhoto(source);
          // Backing out of the picker is not a failure and says nothing.
          if (photo) {
            onUploaded(await uploadPhoto(uid, photo));
          }
        } catch (e) {
          // Both services already phrase their own messages for a human; anything
          // else is a bug here rather than something the user can act on.
          const known =
            e instanceof PhotoPickerError || e instanceof UploadError;
          if (!known) {
            console.warn('Avatar photo failed:', e);
          }
          setError(
            known
              ? (e as Error).message
              : "We couldn't add that photo. Please try again.",
          );
        } finally {
          setBusy(false);
        }
      })();
    },
    [busy, onUploaded, uid],
  );

  // The pencil is drawn whether or not this build can honour it, so the reason
  // has to be reachable without a picker throwing it. Same sentence either way —
  // it is the picker's own explanation, not a second one written here.
  const showUnavailable = useCallback(() => setError(PICKER_UNAVAILABLE), []);

  const clearError = useCallback(() => setError(null), []);

  return { available, busy, error, pick, showUnavailable, clearError };
}
