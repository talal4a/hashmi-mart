/**
 * Cloudinary, from the client side only.
 *
 * There is no API secret in this file and none may ever be added. A Cloudinary
 * secret inside an APK is extractable in minutes, and it authorises upload,
 * transform *and delete* on the whole account — so shipping one would hand any
 * user of this app the ability to wipe every image in it. What is here instead is
 * an **unsigned upload preset**: the cloud name and the preset name are public by
 * design (they travel in every upload request from every client), and the actual
 * limits live in the Cloudinary console where a phone cannot edit them.
 *
 * One-time setup, in the Cloudinary console — uploads fail with "Upload preset not
 * found" until this exists:
 *
 *   Settings → Upload → Upload presets → Add upload preset
 *     Name                 hashmi_avatars
 *     Signing mode         Unsigned
 *     Folder               avatar
 *     Allowed formats      jpg, png, webp, heic
 *     Max file size        2000000        (2 MB)
 *     Unique filename      on
 *     Incoming transform   c_limit,w_1024,h_1024,q_auto        (belt and braces:
 *                          the app already downscales, this stops a crafted
 *                          request storing something enormous)
 *
 * That last row is the part that cannot be bypassed. Everything the app does
 * before uploading is a courtesy to the user's data plan; the preset is the
 * boundary.
 *
 * If these two values ever need to differ per build, they belong in
 * `EXPO_PUBLIC_CLOUDINARY_*` env vars rather than anywhere private — they are not
 * secrets, and treating them as if they were only obscures where the real one is.
 */
export const CLOUDINARY = {
  /** From `CLOUDINARY_URL=cloudinary://key:secret@<cloudName>`. */
  cloudName: 'xzyaejon',
  /** Must match the preset created above, exactly. */
  uploadPreset: 'hashmi_avatars',
  /** Every user photo lands here, and the preset pins it too. */
  folder: 'avatar',
} as const;

/** Where an unsigned upload is POSTed. */
export const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`;

/**
 * Ask Cloudinary for a copy of a stored image that suits the box it is going into.
 *
 * This is where "make sure it is compressed" is actually won. One master is
 * stored, and each consumer requests its own size: `f_auto` serves WebP or AVIF to
 * a device that accepts it, `q_auto` picks the lowest quality that still looks
 * clean for *that* image, and `c_fill,g_face` crops to the square an avatar needs
 * without cutting anyone's head off. A 92dp hero on a 3x screen ends up asking for
 * ~276px — a few KB against the ~200KB the upload itself was.
 *
 * Anything that is not a Cloudinary delivery URL is returned untouched, because
 * the same field also holds Google profile photos on accounts that never uploaded
 * one, and rewriting those would break them.
 */
export function deliveryUrl(url: string, px: number): string {
  const marker = '/image/upload/';
  const at = url.indexOf(marker);
  if (at < 0 || !url.includes('res.cloudinary.com')) {
    return url;
  }
  const size = Math.max(64, Math.round(px));
  const t = `f_auto,q_auto,c_fill,g_face,w_${size},h_${size}`;
  return `${url.slice(0, at + marker.length)}${t}/${url.slice(at + marker.length)}`;
}

/**
 * Voice orders get their own preset, deliberately not the avatar one.
 *
 * A recording of somebody's voice is more sensitive than a profile picture, and
 * the two need different limits — different formats, a much smaller cap, a
 * different folder. Sharing a preset would mean loosening whichever one is
 * stricter, and the stricter one is the one protecting the recordings.
 *
 * Unsigned, like the avatar preset, and for the same reason: no secret ships in
 * the app. What bounds it is the preset's own configuration in the console, so
 * this is the one-time setup —
 *
 *   Settings → Upload → Upload presets → Add upload preset
 *     Name                 hashmimart_voice_orders_v1
 *     Signing mode         Unsigned
 *     Folder               hashmimart/voice-orders
 *     Resource type        Video          (Cloudinary files audio under video)
 *     Allowed formats      m4a, mp3, wav, aac
 *     Max file size        2000000        (2 MB — roughly 120s at 64kbps mono)
 *     Overwrite            off
 *     Eager transforms     none           (they cost quota and change nothing)
 *
 * This is an interim architecture, not private storage. Delivery URLs are
 * public to anyone holding one, which is acceptable only because identifiers
 * are opaque and carry no name, phone, address or email. Before a public
 * launch, playback should move to signed delivery behind an admin check.
 */
export const CLOUDINARY_VOICE = {
  /** Must match the preset created above, exactly. */
  uploadPreset: 'hashmimart_voice_orders_v1',
  /** The preset pins this too; stated here only so the client can assert it. */
  folder: 'hashmimart/voice-orders',
} as const;

/**
 * Where a voice recording is POSTed.
 *
 * `/video/upload`, not `/audio/upload`: Cloudinary has no audio resource type
 * and files audio under video. Posting to the image endpoint fails with a
 * format error that reads like a corrupt file.
 */
export const VOICE_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/video/upload`;
