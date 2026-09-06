/**
 * A character walking in.
 *
 * The entry itself is SceneLayer's job; all this adds is the gait. The body rises
 * on |sin| so it never dips below the floor, an integer number of half-strides so
 * it lands flat instead of mid-bounce, and the whole cycle is damped by (1 −
 * progress) so the last step is the smallest — which is what walking to a stop
 * actually looks like.
 *
 * The lift lives on an inner view rather than being folded into the entry offset,
 * because the shadow has to follow the entry *without* following the lift: feet
 * leaving the ground is the whole reason the shadow pulses.
 *
 * That inner view is also where the hardware texture goes, and SceneLayer's is turned
 * off. A hardware layer is dirtied by anything animating below it, so leaving the
 * outer one on would have it re-rasterise the character on every frame of the bob.
 * Put on the innermost animated view instead, both transforms composite a texture
 * that was drawn once.
 */
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import type { ArtBox } from './art/boxes';
import SceneLayer from './SceneLayer';
import type { Layout } from './geometry';
import type { Entry } from './tokens';

type Props = {
  box: ArtBox;
  entry: Entry;
  progress: SharedValue<number>;
  layout: Layout;
  gait: { steps: number; lift: number };
  children: ReactNode;
};

/** Shared with ShadowLayer so the pulse is provably the inverse of the bounce. */
export function stride(p: number, steps: number): number {
  'worklet';
  return Math.abs(Math.sin(p * Math.PI * steps)) * (1 - p);
}

export default function WalkLayer({
  box,
  entry,
  progress,
  layout,
  gait,
  children,
}: Props) {
  const bob = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: -stride(progress.value, gait.steps) * gait.lift * layout.k,
      },
    ],
  }));

  return (
    <SceneLayer
      box={box}
      entry={entry}
      progress={progress}
      layout={layout}
      rasterize={false}
    >
      <Animated.View
        renderToHardwareTextureAndroid
        style={[StyleSheet.absoluteFill, bob]}
      >
        {children}
      </Animated.View>
    </SceneLayer>
  );
}
