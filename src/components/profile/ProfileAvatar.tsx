import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { User } from 'lucide-react-native';
import { STATE_MS } from '../auth/motion';
import { deliveryUrl } from '../../config/cloudinary';
import { initialsFrom } from '../../utils/initials';
import trace from '../../utils/trace';
import AvatarArt from './avatars/AvatarArt';
import type { AvatarPreset } from './avatars/catalog';

/** Android and iOS both cap out around 3x, so this is the useful ceiling. */
const PIXEL_RATIO = 3;

type Props = {
  /** A chosen built-in avatar. Wins over both photos when set. */
  preset: AvatarPreset | null;
  /** The user's own uploaded photo. Wins over the provider's. */
  avatarUrl?: string | null;
  photoURL?: string | null;
  /** The live value of the name field, so the initials keep up with typing. */
  name: string;
  email?: string | null;
  size?: number;
};

/**
 * Whoever the user is right now, at whatever size — the one place that decides
 * what a profile picture falls back to.
 *
 * The order is chosen character, then the photo the user uploaded, then the one
 * their provider supplied, then initials, then a glyph. Each step exists for a
 * real account: a Google user who picked a character expects the character; one
 * who uploaded a picture expects their picture and not the Google thumbnail they
 * were trying to replace; one who did neither expects the thumbnail; an email user
 * has none of the three until they type a name; and a brand-new email account has
 * nothing at all for the first keystroke or two.
 *
 * A remote photo that fails to load falls through to the next step rather than
 * leaving a hole, which is the difference between a slow connection and a broken
 * screen. The flag resets when the URL changes so a retry is still possible.
 *
 * The URL is requested at the size it will actually be drawn — see deliveryUrl. A
 * 52dp chip and a 92dp hero share one stored master and download different images,
 * which matters here because this component renders six times on one screen.
 */
export default function ProfileAvatar({
  preset,
  avatarUrl,
  photoURL,
  name,
  email,
  size = 96,
}: Props) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;

  const source = avatarUrl || photoURL || null;
  useEffect(() => setPhotoFailed(false), [source]);

  // A dip and return rather than a cross-fade of two layers: the artwork swaps
  // at the bottom of the dip, so it reads as a dissolve without ever mounting
  // two avatars — which at 96dp with eight gradients each is worth avoiding.
  //
  // Uses RN's built-in Animated (not Reanimated) because this view wraps
  // react-native-svg children. Reanimated's UI-thread worklet can race with
  // Fabric's view removal during navigation.reset(), causing the
  // SurfaceMountingManager error. RN Animated with useNativeDriver handles
  // cleanup natively — no JSI worklet, no race.
  //
  // The first run is skipped, which is not an optimisation of the effect so much
  // as a correction: a dissolve marks a *change*, and on mount nothing changed.
  // What it actually did was start six native fades — this component renders six
  // times on Complete Profile — the moment the screen appeared, over subtrees
  // holding SVG canvases, in the window where the previous screen is still being
  // torn down. Values that begin at rest and stay there cannot be mid-write when
  // Fabric deletes a tag.
  const token = preset?.id ?? (source && !photoFailed ? source : 'initials');
  const swapped = useRef(false);
  useEffect(() => {
    if (!swapped.current) {
      swapped.current = true;
      return;
    }
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0.5,
        duration: 90,
        easing: Easing.bezier(0.32, 0.42, 0.68, 1),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: STATE_MS,
        easing: Easing.bezier(0.32, 0.42, 0.68, 1),
        useNativeDriver: true,
      }),
    ]).start();
    return () => {
      opacity.stopAnimation();
    };
  }, [token]);

  // Development-only, and narrower than it looks: only the `svg` branch matters.
  // An SvgView dispatches a layout event from inside its own draw pass, which is
  // what makes Reanimated flush prop updates synchronously, which is what
  // surfaces a stale write left behind by the screen navigation.reset() just
  // deleted. The photo and initials branches never trigger that, so a run where
  // "svg mounted" is absent and the screen still came up white rules this
  // component out entirely. Keyed on the branch rather than on mounting because
  // picking a character swaps branches without remounting. See utils/trace.
  const kind = preset ? 'svg' : source && !photoFailed ? 'photo' : 'text';
  useEffect(() => {
    trace('ProfileAvatar', `${kind} mounted`);
    return () => trace('ProfileAvatar', `${kind} unmounted`);
  }, [kind]);

  const initials = initialsFrom(name, email);

  return (
    <Animated.View
      style={[
        {
          opacity,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#e0f7fb',
          shadowColor: '#0B2027',
          shadowOpacity: 0.1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        },
      ]}
      className="items-center justify-center overflow-hidden"
    >
      {preset ? (
        <AvatarArt preset={preset} size={size} />
      ) : source && !photoFailed ? (
        <Image
          source={{ uri: deliveryUrl(source, size * PIXEL_RATIO) }}
          onError={() => setPhotoFailed(true)}
          style={{ width: size, height: size }}
          accessibilityIgnoresInvertColors
        />
      ) : initials ? (
        <Text
          style={{ fontSize: size * 0.34, lineHeight: size * 0.42 }}
          className="font-bold text-[#0e7490]"
        >
          {initials}
        </Text>
      ) : (
        <User size={size * 0.44} color="#67cfe0" strokeWidth={1.8} />
      )}
    </Animated.View>
  );
}
