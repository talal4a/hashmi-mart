/**
 * One piece of the illustration, arriving.
 *
 * The layer is positioned at its home box and offset *backwards* along its entry
 * vector by (1 − progress), so it converges on its own coordinates in the shared
 * 500-unit space. Nothing here knows where anything belongs — that comes from
 * boxes.ts, which is generated from the artwork itself.
 *
 * `renderToHardwareTextureAndroid` is what keeps that cheap. The child is a static
 * SVG of up to ~980 paths; without it, every frame of the translate replays all of
 * those draw calls. With it, Android rasterises the subtree once into a GPU texture
 * and the animation is a textured quad being moved, which is the difference between
 * a transform costing hundreds of path fills and costing nothing. It is safe to leave
 * on because the contents never change — and none of these layers scale above 1, so
 * the texture is never asked to stretch past the size it was rasterised at.
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
import { FADE, type Entry } from './tokens';

type Props = {
  box: ArtBox;
  entry: Entry;
  progress: SharedValue<number>;
  layout: Layout;
  /**
   * Off when something *inside* this layer animates too. A hardware layer is
   * invalidated by any change beneath it, so a nested animation would have it
   * re-rasterised every frame — worse than not having one. WalkLayer turns it off
   * here and puts it on its own inner view instead.
   */
  rasterize?: boolean;
  /**
   * How long this layer takes to become present, as a fraction of its beat. The
   * default is the guard every sliding layer wants; the floor asks for the long
   * one because its fade is its entrance rather than a cover. See FADE in tokens.
   */
  fade?: number;
  children: ReactNode;
};

export default function SceneLayer({
  box,
  entry,
  progress,
  layout,
  rasterize = true,
  fade = FADE.entry,
  children,
}: Props) {
  const style = useAnimatedStyle(() => {
    const away = 1 - progress.value;
    return {
      opacity: interpolate(
        progress.value,
        [0, fade],
        [0, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        { translateX: entry.dx * away * layout.k },
        { translateY: entry.dy * away * layout.k },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid={rasterize}
      style={[place(box, layout), style]}
    >
      {children}
    </Animated.View>
  );
}
