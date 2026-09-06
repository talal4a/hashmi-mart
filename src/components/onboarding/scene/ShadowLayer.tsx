/**
 * A shadow, tied to the thing casting it.
 *
 * It takes its owner's entry vector, its owner's clock and its owner's fade, so it
 * sits under that object on every frame of the entry and is exactly as present as
 * the object is. All three now matter: since each object has its own direction, a
 * shadow reading anything but its owner's vector would slide out from under it, and
 * one reading its own fade window would leave a solid object crossing the frame
 * trailing a half-there shadow.
 *
 * It does not spread on arrival any more. That behaviour was the contact shadow of
 * something being lowered onto the floor, and nothing here is lowered — a ground-axis
 * entry slides an object across the floor, and the screen-y that comes with it is the
 * isometric projection of horizontal travel, not a fall. So shadows arrive full size.
 *
 * The one thing that does move is the walk. A foot leaving the floor tightens and
 * lightens its shadow and lands wider and darker again, so characters and the cart
 * pulse slightly against the gait. That is applied here rather than in WalkLayer for
 * a reason: the body's lift must never reach the shadow, because a shadow that
 * bounced with the feet would look glued to them.
 *
 * Rasterised to a texture like the other layers. Worth noting because this is the
 * one thing in the scene that scales: a hardware layer is drawn at the view's own
 * size and the scale is applied to the texture, so scaling *up* past 1 would soften
 * it. The only scale left is the character pulse, which dips to 0.94 and never rises
 * above 1, so the texture is only ever shrunk.
 */
import type { ReactNode } from 'react';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import type { ArtBox } from './art/boxes';
import { place, type Layout } from './geometry';
import { stride } from './WalkLayer';
import { FADE, SHADOW, type Entry } from './tokens';

type Props = {
  box: ArtBox;
  entry: Entry;
  progress: SharedValue<number>;
  layout: Layout;
  /** Present for characters: how many half-strides to pulse against. */
  gait?: { steps: number };
  /** The owner's fade window. Defaults to the one every sliding layer uses. */
  fade?: number;
  children: ReactNode;
};

export default function ShadowLayer({
  box,
  entry,
  progress,
  layout,
  gait,
  fade = FADE.entry,
  children,
}: Props) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const away = 1 - p;
    const step = gait ? stride(p, gait.steps) : 0;
    const up = interpolate(p, [0, fade], [0, 1], Extrapolation.CLAMP);

    return {
      opacity: gait ? up * (1 - SHADOW.pulseOpacity * step) : up,
      // Translate first so it is the outer transform: the shadow pulses about its
      // own centre, then is carried along the ground with its owner.
      transform: [
        { translateX: entry.dx * away * layout.k },
        { translateY: entry.dy * away * layout.k },
        { scale: 1 - SHADOW.pulseScale * step },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid
      style={[place(box, layout), style]}
    >
      {children}
    </Animated.View>
  );
}
