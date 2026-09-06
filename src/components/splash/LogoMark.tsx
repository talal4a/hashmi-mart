import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import BasketItem from './BasketItem';
import RoofPart from './RoofPart';
import SheenBand from './SheenBand';
import { CART, ITEMS } from './parts';
import cancelAll from '../../utils/cancelAll';
import {
  BOX_H,
  DRIFT,
  ENTER_MS,
  LOGO_W,
  MARK_DIM,
  MARK_H,
  PAD_TOP,
  POLISH_DELAY,
  POLISH_MS,
  RISE,
  RISE_SPRING,
  SEAL_DELAY,
  SEAL_MS,
  SETTLE_FROM,
  SETTLE_SPRING,
  SHEEN_DELAY,
  SHEEN_MS,
} from './tokens';

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_SHEEN = Easing.bezier(0.4, 0, 0.2, 1);

type Props = {
  /** 0→1 hand-off driver, owned by SplashSequence. */
  exit: SharedValue<number>;
};

/**
 * The cart-and-roof half of the logo, assembled rather than presented.
 *
 * The mark is built from separate layers — the cart, the roof, and five pieces of
 * shopping (see parts.ts) — so the logo can put itself together: the cart
 * arrives, the roof drops onto it, then the shopping pops into the basket. At
 * rest the layers recompose the original artwork pixel for pixel.
 *
 * Over that sits the light: a band travelling across the mark, confined to its
 * silhouette by a stencil — the field colour with the mark punched out of it.
 * That is what an SVG `<Mask>` would do, except this is only ever an `<Image>`,
 * so there is no masking support to be wrong about on a given platform. Two
 * things follow, and both are easy to break:
 *
 *  - The stencil is the inverse of the *finished* mark, so it cannot be laid down
 *    until every part has stopped moving; anything still in flight would be
 *    painted over with field colour. Hence the seal at SEAL_DELAY, and hence the
 *    parts animating on beziers with known end times rather than on springs.
 *  - The stencil colour must equal SPLASH_BG exactly; see the note in tokens.ts.
 *
 * The mark holds at MARK_DIM until the light has passed, then settles to full
 * white. So the sheen doesn't glint off the mark, it polishes it — the assembly
 * and the highlight finish as one gesture instead of two.
 */
export default function LogoMark({ exit }: Props) {
  const enter = useSharedValue(0);
  const rise = useSharedValue(1);
  const settle = useSharedValue(SETTLE_FROM);
  const seal = useSharedValue(0);
  const sheen = useSharedValue(0);
  const polish = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, { duration: ENTER_MS, easing: EASE_OUT });
    // Springs, not timings, for the two that carry weight. An overshoot of a
    // few percent is the difference between something arriving and something
    // being switched on. Safe to leave un-landed at the seal, unlike the parts:
    // these are on the box, so the stencil rides along with whatever they do.
    // Constants live in tokens.ts with the rest of the pacing.
    rise.value = withSpring(0, RISE_SPRING);
    settle.value = withSpring(1, SETTLE_SPRING);
    seal.value = withDelay(SEAL_DELAY, withTiming(1, { duration: SEAL_MS }));
    sheen.value = withDelay(
      SHEEN_DELAY,
      withTiming(1, { duration: SHEEN_MS, easing: EASE_SHEEN }),
    );
    polish.value = withDelay(
      POLISH_DELAY,
      withTiming(1, { duration: POLISH_MS, easing: Easing.out(Easing.quad) }),
    );
    // The splash leaves by navigation.reset(), which deletes these views in one
    // mount transaction. The two springs are the reason this cleanup is here at
    // all: every timing above has a known end well inside the 2650ms gate, but a
    // spring only stops when it settles, so they are the ones that could still be
    // writing when the reset lands. See utils/cancelAll.
    return () => {
      cancelAll([enter, rise, settle, seal, sheen, polish]);
    };
  }, []);

  // Scale is entry-only on purpose. The mark leaves by drifting the way it came
  // in and fading; it never scales out.
  const boxStyle = useAnimatedStyle(() => ({
    opacity: enter.value * (1 - exit.value),
    transform: [
      { translateY: RISE * rise.value + DRIFT * exit.value },
      { scale: settle.value },
    ],
  }));

  // One opacity for the whole assembly rather than one per part, and that is
  // deliberate: the roof crosses the basket while it is still falling, and
  // per-part opacity would brighten the overlap into a visible seam. A group
  // opacity composites the union once.
  const partsStyle = useAnimatedStyle(() => ({
    opacity: MARK_DIM + (1 - MARK_DIM) * polish.value,
  }));

  // Invisible when it appears — flat field colour over a flat field — and it has
  // to be gone before ExitReveal repaints that field, or the mark's box shows up
  // as a rectangle on the way out. Retiring it is free: the sheen has always
  // finished by the time the gate opens, so by then there is no longer any light
  // for it to be confining.
  const stencilStyle = useAnimatedStyle(() => ({
    opacity: seal.value * (1 - Math.min(1, exit.value * 4)),
  }));

  return (
    <Animated.View style={[styles.box, boxStyle]}>
      <Animated.View style={[styles.mark, partsStyle]}>
        <Animated.Image
          source={require('../../assets/images/splash/cart.png')}
          style={styles.cart}
          resizeMode="stretch"
        />
        <RoofPart />
        {ITEMS.map((item, i) => (
          <BasketItem key={i} box={item.box} source={item.source} index={i} />
        ))}
      </Animated.View>
      {/* The light lives in its own clipped chamber so the band can start and
          finish outside the silhouette while the parts above stay free to move
          in the headroom PAD_TOP gives them. */}
      <View style={styles.chamber}>
        <SheenBand progress={sheen} />
        <Animated.Image
          source={require('../../assets/images/splash/mark-stencil.png')}
          style={[styles.stencil, stencilStyle]}
          resizeMode="stretch"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: LOGO_W,
    height: BOX_H,
  },
  mark: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: LOGO_W,
    height: BOX_H,
  },
  cart: {
    position: 'absolute',
    left: CART.x,
    top: PAD_TOP + CART.y,
    width: CART.w,
    height: CART.h,
  },
  chamber: {
    position: 'absolute',
    left: 0,
    top: PAD_TOP,
    width: LOGO_W,
    height: MARK_H,
    overflow: 'hidden',
  },
  stencil: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: LOGO_W,
    height: MARK_H,
  },
});
