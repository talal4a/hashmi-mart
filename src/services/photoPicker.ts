/**
 * The system photo picker, if this build has one.
 *
 * `expo-image-picker` is a native module: it needs an install *and* a rebuild, and
 * until both have happened the module is not in the bundle. This file is the only
 * place in the app that reaches for it, and it never assumes it is there — the
 * whole feature is behind `photoPickerReady()`, so a build without the package
 * shows a disabled button and an explanation instead of a red screen.
 *
 * That guard is not paranoia. An empty `@react-native-google-signin` directory once
 * took down this app's entire bundle, because the module was touched at import
 * time; the lesson is that an optional native dependency has to be optional at the
 * moment it is read, not just in intent. metro.config.js resolves a missing
 * optional module to an empty one, so `require` here returns `{}` rather than
 * throwing — which is why the check below is for the *function*, not the module.
 *
 * To turn it on:
 *
 *   npx expo install expo-image-picker
 *   npm run android          # a native rebuild, not a Metro reload
 *
 * `android/` is committed, so `prebuild` does not run and the module's config
 * plugin never applies: `android.permission.CAMERA` is hand-added to
 * `android/app/src/main/AndroidManifest.xml` instead. Gallery access needs no
 * permission from API 33 on (the system photo picker) and the manifest already
 * carries `READ_EXTERNAL_STORAGE` capped at 32 for older devices.
 *
 * The plugin block below belongs in `app.json` *after* the install, and only
 * then — Expo resolves every listed plugin at startup, so naming a module that
 * is not there yet fails `expo start` outright:
 *
 *   ["expo-image-picker", {
 *     "photosPermission": "HashmiMart uses your photos so you can set a profile picture.",
 *     "cameraPermission": "HashmiMart uses your camera so you can take a profile picture."
 *   }]
 */

// Metro's own require. The RN types do not ship a declaration for it, and this is
// deliberately not an `import`: an import is resolved when the bundle is built,
// which is exactly the failure this file exists to avoid.
declare const require: (name: string) => unknown;

/** A photo the user chose, ready to upload. */
export type PickedPhoto = {
  uri: string;
  mime: string;
  name: string;
};

/** Where the photo comes from. Everything after the launch is identical. */
export type PhotoSource = 'library' | 'camera';

/**
 * Re-encode and crop before anything leaves the phone.
 *
 * A modern phone camera produces 4000×3000 at 4–8MB, and this ends up inside a
 * 92dp circle. Quality 0.72 re-encodes it to a JPEG in the low hundreds of KB,
 * which is roughly a 30x saving on a mobile connection and still more resolution
 * than any screen in the app asks for. The crop is square and interactive for the
 * same reason: an avatar is a circle, so letting the user choose what is inside it
 * beats centre-cropping their photo for them.
 *
 * The picker has no pixel cap, so the *dimension* limit is not set here — it is the
 * `c_limit,w_1024,h_1024` incoming transformation on the upload preset, which is
 * also the only version of that limit a modified client cannot talk its way past.
 * Compression proper happens a third time, on delivery, in config/cloudinary.ts.
 *
 * ffmpeg was considered and is the wrong tool for all three — it is a video
 * pipeline, the maintained React Native binding for it is archived, and it would
 * add 30–60MB to the APK to do a job the picker already does in one option.
 */
const QUALITY = 0.72;

type PickerResult = {
  canceled: boolean;
  assets?: {
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
    width?: number;
    height?: number;
  }[];
};

type PickerPermission = {
  granted: boolean;
  canAskAgain?: boolean;
};

type Launch = (options: unknown) => Promise<PickerResult>;
type RequestAccess = () => Promise<PickerPermission>;

/**
 * The camera half is optional in the *type* as well as at runtime.
 *
 * Both functions ship in the same module, so in practice they arrive together —
 * but `load()` deliberately gates the whole feature on the library function
 * alone. Were a future version to rename or drop the camera one, marking it
 * optional here means TypeScript forces the check below rather than letting a
 * gallery upload break over a camera that was never the point.
 */
type PickerModule = {
  launchImageLibraryAsync: Launch;
  requestMediaLibraryPermissionsAsync: RequestAccess;
  launchCameraAsync?: Launch;
  requestCameraPermissionsAsync?: RequestAccess;
};

function load(): PickerModule | null {
  try {
    const mod = require('expo-image-picker') as Partial<PickerModule> | null;
    return mod && typeof mod.launchImageLibraryAsync === 'function'
      ? (mod as PickerModule)
      : null;
  } catch {
    return null;
  }
}

/** Whether this build can open the photo library at all. */
export function photoPickerReady(): boolean {
  return load() !== null;
}

/** What to tell the user when it cannot. */
export const PICKER_UNAVAILABLE =
  'Uploading a photo needs an app update. You can still pick a character.';

export class PhotoPickerError extends Error {}

/**
 * Refused access, in the two ways it happens.
 *
 * `blocked` is the one that matters. A declined prompt can be re-asked, so
 * "we need permission" is a true statement about the next tap; once Android
 * stops asking, the same sentence is a lie and the only route left is Settings.
 * The distinction is `canAskAgain`, and it is worth two strings per source
 * because a user sent to Settings needs to know *which* switch to look for.
 */
const ACCESS_DENIED: Record<PhotoSource, { blocked: string; denied: string }> = {
  library: {
    blocked:
      'Photo access is off for HashmiMart. Turn it on in Settings to upload a picture.',
    denied: 'We need permission to open your photos.',
  },
  camera: {
    blocked:
      'Camera access is off for HashmiMart. Turn it on in Settings to take a picture.',
    denied: 'We need permission to use your camera.',
  },
};

/**
 * Square, cropped by the user, and re-encoded before it leaves the phone.
 *
 * Hoisted because both sources take the same options — a camera capture that
 * skipped the crop would store a 4:3 frame for a circular hole, and the two
 * paths drifting apart is exactly the kind of difference nobody notices until
 * one of them looks wrong.
 */
const PICK_OPTIONS = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: QUALITY,
  // Keeps the JS bridge out of it: only the file URI crosses, never the bytes.
  base64: false,
  exif: false,
} as const;

/**
 * Open the chosen source and return the photo, or null if the user backed out.
 *
 * Cancelling is not an error and must not read like one: it is the normal way to
 * leave a picker, so it returns null and the caller shows nothing at all.
 */
export async function pickPhoto(
  source: PhotoSource = 'library',
): Promise<PickedPhoto | null> {
  const picker = load();
  if (!picker) {
    throw new PhotoPickerError(PICKER_UNAVAILABLE);
  }

  const launch =
    source === 'camera' ? picker.launchCameraAsync : picker.launchImageLibraryAsync;
  const requestAccess =
    source === 'camera'
      ? picker.requestCameraPermissionsAsync
      : picker.requestMediaLibraryPermissionsAsync;

  // Only reachable if the module changed shape under us; see PickerModule.
  if (typeof launch !== 'function' || typeof requestAccess !== 'function') {
    throw new PhotoPickerError(PICKER_UNAVAILABLE);
  }

  const permission = await requestAccess();
  if (!permission.granted) {
    const copy = ACCESS_DENIED[source];
    throw new PhotoPickerError(
      permission.canAskAgain === false ? copy.blocked : copy.denied,
    );
  }

  const result = await launch(PICK_OPTIONS);

  const asset = result.canceled ? undefined : result.assets?.[0];
  if (!asset?.uri) {
    return null;
  }

  const mime = asset.mimeType ?? 'image/jpeg';
  return {
    uri: asset.uri,
    mime,
    name: asset.fileName ?? `avatar.${mime.split('/')[1] ?? 'jpg'}`,
  };
}
