import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ActivityIndicator } from 'react-native';
import { Pencil } from 'lucide-react-native';
import ProfileAvatar from './ProfileAvatar';
import type { AvatarPreset } from './avatars/catalog';

const SIZE = 92;
const BADGE = 30;

type Props = {
  preset: AvatarPreset | null;
  avatarUrl: string | null;
  photoURL: string | null;
  name: string;
  email: string | null;
  busy: boolean;
  error: string | null;
  onEdit: () => void;
};

/**
 * The profile picture, with the one affordance that changes it.
 *
 * The badge sits on the hero rather than in the chip rail below, and that is a
 * space decision as much as a conventional one. A sixth chip would have cost the
 * rail another 73dp of scroll on a card that was just shortened by 71dp to clear
 * the fold, and it would have pushed the characters — the thing the rail is for —
 * mostly out of view at rest. A badge on the picture costs nothing: it lands
 * inside the 92dp the hero already occupies.
 *
 * It is a pencil, not a camera. The badge no longer goes straight to the gallery;
 * it opens a sheet whose first row is the camera, whose second is the gallery and
 * whose third removes what is there. A camera glyph would name one row of three,
 * and would promise a shutter to anyone who only wanted to pick a file. A pencil
 * says "change this", which is the whole set.
 *
 * It is also drawn unconditionally, which reverses an earlier call. The badge used
 * to be hidden whenever `expo-image-picker` was missing from the build, on the
 * reasoning that a button which always fails is worse than no button — true of a
 * button that fails *silently*. What it actually produced was a screen with no way
 * to set a photo and nothing to say why, on a build where the only thing missing
 * was a native rebuild. Tapping it now explains itself, and removing a photo needs
 * no picker at all. Where the sheet has nothing to offer, the caller keeps it shut
 * and puts the reason in `error` — see ProfileForm.
 */
export default function AvatarHero({
  preset,
  avatarUrl,
  photoURL,
  name,
  email,
  busy,
  error,
  onEdit,
}: Props) {
  return (
    <View className="items-center">
      <View style={{ width: SIZE, height: SIZE }}>
        <ProfileAvatar
          preset={preset}
          avatarUrl={avatarUrl}
          photoURL={photoURL}
          name={name}
          email={email}
          size={SIZE}
        />

        <Pressable
          onPress={onEdit}
          disabled={busy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Change your profile picture"
          accessibilityState={{ disabled: busy, busy }}
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: BADGE,
            height: BADGE,
            borderRadius: BADGE / 2,
            borderWidth: 2.5,
            borderColor: '#ffffff',
            backgroundColor: busy ? '#67cfe0' : '#06b6d4',
          }}
          className="items-center justify-center"
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Pencil size={14} color="#ffffff" strokeWidth={2.6} />
          )}
        </Pressable>
      </View>

      {/* Reserved space would push the fold for a message that is usually absent,
          so this is allowed to shift the card. It only appears after a tap, which
          is the one moment the user is looking here. */}
      {error ? (
        <Text className="mt-2 px-4 text-center text-[12px] leading-4 text-[#dc2626]">
          {error}
        </Text>
      ) : busy ? (
        <Text className="mt-2 text-center text-[12px] leading-4 text-[#9ca3af]">
          Uploading your photo…
        </Text>
      ) : null}
    </View>
  );
}
