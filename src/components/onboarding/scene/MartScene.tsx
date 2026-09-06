/**
 * The mart, arriving.
 *
 * The whole layer stack lives in one file on purpose: the order these appear in
 * *is* the illustration's own layer order, and splitting it up would hide the one
 * thing a reader needs to take in at a glance. Nothing here positions artwork —
 * each layer takes its home box from art/boxes.ts, its entry vector from tokens.ts
 * and its clock from the timeline the screen owns.
 *
 * All seven shadows sit beneath all six objects, exactly as they do in the source
 * illustration. That is what lets the shading inside the cart read through the
 * cart's open top: it is drawn under the man, not on him.
 *
 * Thirteen layers, six vectors and three clocks, and they deliberately do not line
 * up. A clock says *when* and a vector says *which way*, and everything in this
 * scene arrives paired: the shelf and the freezer share `fixtures` and come in from
 * opposite sides, then the woman, the baskets and the man share `people`, with the
 * man mirroring the other two. Only the floor is alone on its clock, because it is
 * the thing the rest arrive onto.
 *
 * What is rigid is an object and its own shadow. Each shadow below is handed the
 * same ENTRY key and the same beat as the thing casting it, and that is the one
 * pairing in the file that cannot be got wrong — a shadow on anybody else's vector
 * slides out from under its owner within a few frames. The only other rigid pair is
 * there by choice: the baskets ride the woman's vector exactly, so the left half
 * arrives as one arrangement instead of as two things that happen to be near each
 * other.
 *
 * The room is not in here. It covers the whole screen, so the screen owns it, and
 * this file is only the stage: everything that is *drawn artwork* and nothing that
 * is atmosphere.
 *
 * The layout arrives as a prop for the same reason — the backdrop and the stage
 * have to agree on where the scene square sits, to the pixel, or the floor's halo
 * would drift off the floor. One computation, two consumers.
 */
import { StyleSheet, View } from 'react-native';
import Baskets from './art/Baskets';
import BasketsShadow from './art/BasketsShadow';
import CartInnerShadow from './art/CartInnerShadow';
import CartShadow from './art/CartShadow';
import Floor from './art/Floor';
import Freezer from './art/Freezer';
import FreezerShadow from './art/FreezerShadow';
import Man from './art/Man';
import ManShadow from './art/ManShadow';
import Shelf from './art/Shelf';
import ShelfShadow from './art/ShelfShadow';
import Woman from './art/Woman';
import WomanShadow from './art/WomanShadow';
import { ART_BOX } from './art/boxes';
import FloorTiles from './FloorTiles';
import SceneLayer from './SceneLayer';
import ShadowLayer from './ShadowLayer';
import WalkLayer from './WalkLayer';
import type { Layout } from './geometry';
import { ENTRY, FADE, WALK } from './tokens';
import type { Timeline } from './useSceneTimeline';

type Props = { beats: Timeline; layout: Layout };

export default function MartScene({ beats, layout: l }: Props) {
  return (
    <View style={styles.root}>
      <SceneLayer
        box={ART_BOX.floor}
        entry={ENTRY.floor}
        progress={beats.floor}
        layout={l}
        fade={FADE.rise}
      >
        <Floor />
        <FloorTiles />
      </SceneLayer>

      <ShadowLayer
        box={ART_BOX.shelfShadow}
        entry={ENTRY.shelf}
        progress={beats.fixtures}
        layout={l}
      >
        <ShelfShadow />
      </ShadowLayer>
      <ShadowLayer
        box={ART_BOX.freezerShadow}
        entry={ENTRY.freezer}
        progress={beats.fixtures}
        layout={l}
      >
        <FreezerShadow />
      </ShadowLayer>
      <ShadowLayer
        box={ART_BOX.basketsShadow}
        entry={ENTRY.baskets}
        progress={beats.people}
        layout={l}
      >
        <BasketsShadow />
      </ShadowLayer>
      <ShadowLayer
        box={ART_BOX.womanShadow}
        entry={ENTRY.woman}
        progress={beats.people}
        layout={l}
        gait={WALK.woman}
      >
        <WomanShadow />
      </ShadowLayer>
      <ShadowLayer
        box={ART_BOX.manShadow}
        entry={ENTRY.man}
        progress={beats.people}
        layout={l}
        gait={WALK.man}
      >
        <ManShadow />
      </ShadowLayer>
      <ShadowLayer
        box={ART_BOX.cartShadow}
        entry={ENTRY.man}
        progress={beats.people}
        layout={l}
        gait={WALK.man}
      >
        <CartShadow />
      </ShadowLayer>
      {/* Not a ground shadow: it is shading inside the basket, so it rides the
          cart's bob instead of pulsing against it. */}
      <WalkLayer
        box={ART_BOX.cartInnerShadow}
        entry={ENTRY.man}
        progress={beats.people}
        layout={l}
        gait={WALK.man}
      >
        <CartInnerShadow />
      </WalkLayer>

      <SceneLayer
        box={ART_BOX.shelf}
        entry={ENTRY.shelf}
        progress={beats.fixtures}
        layout={l}
      >
        <Shelf />
      </SceneLayer>
      <SceneLayer
        box={ART_BOX.freezer}
        entry={ENTRY.freezer}
        progress={beats.fixtures}
        layout={l}
      >
        <Freezer />
      </SceneLayer>
      <SceneLayer
        box={ART_BOX.baskets}
        entry={ENTRY.baskets}
        progress={beats.people}
        layout={l}
      >
        <Baskets />
      </SceneLayer>

      <WalkLayer
        box={ART_BOX.woman}
        entry={ENTRY.woman}
        progress={beats.people}
        layout={l}
        gait={WALK.woman}
      >
        <Woman />
      </WalkLayer>
      <WalkLayer
        box={ART_BOX.man}
        entry={ENTRY.man}
        progress={beats.people}
        layout={l}
        gait={WALK.man}
      >
        <Man />
      </WalkLayer>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Clipped, and load-bearing. Every object now starts outside this box — the shelf,
   * the woman and the baskets past its left edge, the freezer and the man past its
   * right — so the clip is what makes the slot the thing they arrive *from*. Without
   * it they would sit in the margins beside the copy waiting for their beat, and
   * FADE would have to hide them instead of merely guarding them.
   */
  root: { flex: 1, overflow: 'hidden' },
});
