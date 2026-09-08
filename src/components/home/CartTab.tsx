import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { tapSend } from '../voice/haptics';
import CartMark from './CartMark';

/**
 * The centre cart: object, contact shadow, badge and label.
 *
 * There is deliberately no pedestal. An earlier version had one, and it was the
 * reason the tab looked wrong: the cart already had a cutout framing it and a
 * shadow anchoring it, and a solid glass box made three containers around one
 * small control. The eye reads box, then cart, then dip, then label, and cannot
 * tell which of them is the button. A dimensional object does not need
 * furniture to stand on — the shadow under its wheels is what says it is
 * resting on something, and a hard rectangle behind it only gives its silhouette
 * something to compete with.
 *
 * So one anchor, not three. The cart sits *in* the bar with its wheels on the
 * glass, and the surface dips just enough to acknowledge it.
 *
 * The model is the one thing this file does not draw. `CART_ART` is the seam
 * for a transparent render; until one exists `CartMark` stands in at the same
 * size and position, so scale, anchoring and motion are already correct and
 * dropping artwork in changes nothing else.
 */

/**
 * A transparent render of the cart, when there is one.
 *
 * Replace with `require('../../assets/images/cart-3d.webp')`. It must be a
 * local asset: fetching it would mean the bar renders without a cart on a cold
 * start, which is the layout shift this component is shaped to avoid.
 */
const CART_ART: number | null = null;

/** The object's drawn size. */
export const MODEL = 46;

/**
 * How far the cart stands above the bar's top edge.
 *
 * 14 of 46 is 30%. Most of the cart is inside the nav, which is what makes it
 * read as a control in the row rather than a trolley parked over the page — and
 * it puts the label on the same line as the other four.
 */
export const CART_RISE = 14;

/** Contact shadow, sized to the wheelbase rather than to the whole object. */
const SHADOW_W = 32;
const SHADOW_H = 7;

/** Reserved from the first frame, so artwork arriving later cannot resize the bar. */
export const CART_SLOT_HEIGHT = MODEL + 11 + 12;

type Props = {
  count: number;
  active?: boolean;
  onPress: () => void;
};

export default function CartTab({ count, active = false, onPress }: Props) {
  const reduced = useReducedMotion();

  const float = useSharedValue(0);
  const press = useSharedValue(0);
  const badgePop = useSharedValue(0);

  /**
   * A breath every five seconds, 1.5px.
   *
   * Below the threshold where it becomes something you watch. The delay takes
   * most of the cycle, so the movement arrives as something noticed rather than
   * a rhythm — a cart that bobs continuously reads as a loading state.
   */
  useEffect(() => {
    cancelAnimation(float);
    if (reduced) {
      float.value = 0;
      return;
    }
    float.value = withRepeat(
      withSequence(
        withDelay(
          4200,
          withTiming(1, { duration: 420, easing: Easing.inOut(Easing.quad) }),
        ),
        withTiming(0, { duration: 620, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(float);
  }, [reduced, float]);

  // Driven by the count, not the tap: an item added from a product card has to
  // be acknowledged here too.
  const previous = useRef(count);
  useEffect(() => {
    if (count === previous.current) return;
    previous.current = count;
    if (reduced || count === 0) return;
    badgePop.value = withSequence(
      withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 12, stiffness: 260, mass: 0.5 }),
    );
  }, [count, reduced, badgePop]);

  const modelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -1.5 * float.value + 1.5 * press.value },
      { scale: 1 - 0.05 * press.value },
      { rotate: `${-0.6 * float.value + 1.2 * press.value}deg` },
    ],
  }));

  /**
   * The shadow does the anchoring on its own.
   *
   * It tightens and darkens as the cart settles onto it and spreads and fades
   * as the cart lifts, which is the whole of what tells the eye the two are in
   * contact. A shadow that stays constant while the object moves is what makes
   * a composite look pasted together.
   */
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + 0.07 * press.value - 0.06 * float.value,
    transform: [
      { scaleX: 1 - 0.1 * float.value + 0.07 * press.value },
      { scaleY: 1 - 0.14 * float.value },
    ],
  }));

  // Active is a bloom rather than a box: it tints the surface under the cart
  // without adding another edge for the silhouette to fight.
  const glowStyle = useAnimatedStyle(() => ({
    opacity: (active ? 0.85 : 0) * (1 - 0.15 * float.value),
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.35 * badgePop.value }],
  }));

  const down = () => {
    press.value = withTiming(1, { duration: 90 });
  };
  const up = () => {
    press.value = withSpring(0, { damping: 15, stiffness: 300, mass: 0.5 });
  };

  return (
    <View style={s.slot} pointerEvents="box-none">
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={
          count > 0 ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Cart'
        }
        testID="home-cart"
        onTouchStart={down}
        onTouchEnd={up}
        onTouchCancel={up}
        style={s.hit}
        onStartShouldSetResponder={() => true}
        onResponderRelease={() => {
          tapSend();
          onPress();
        }}
      >
        <Animated.View pointerEvents="none" style={[s.glow, glowStyle]} />
        <Animated.View pointerEvents="none" style={[s.shadow, shadowStyle]} />

        <Animated.View style={[s.model, modelStyle]} pointerEvents="none">
          {CART_ART ? (
            <Animated.Image
              source={CART_ART}
              style={s.art}
              resizeMode="contain"
              fadeDuration={0}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <CartMark size={MODEL} />
          )}
        </Animated.View>

        {count > 0 ? (
          <Animated.View pointerEvents="none" style={[s.badge, badgeStyle]}>
            <Text style={s.badgeText}>{count > 99 ? '99+' : count}</Text>
          </Animated.View>
        ) : null}
      </Animated.View>

      <Text style={[s.label, active && s.labelActive]} numberOfLines={1}>
        Cart
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  slot: { height: CART_SLOT_HEIGHT, alignItems: 'center' },
  hit: { width: MODEL + 14, height: MODEL, alignItems: 'center' },

  // Sits under the wheels, on the bar's own glass. Small and soft: a large
  // shadow reads as the cart hovering, which is the opposite of the point.
  shadow: {
    position: 'absolute',
    bottom: 1,
    width: SHADOW_W,
    height: SHADOW_H,
    borderRadius: SHADOW_H,
    backgroundColor: '#0B4A63',
  },
  // Wider and softer than the shadow, and behind it.
  glow: {
    position: 'absolute',
    bottom: -4,
    width: MODEL + 10,
    height: 22,
    borderRadius: 14,
    backgroundColor: '#8ADCFA',
  },

  model: { width: MODEL, height: MODEL },
  art: { width: MODEL, height: MODEL },

  // Upper right, clear of the basket mouth so it never covers the geometry
  // that makes the cart readable.
  badge: {
    position: 'absolute',
    top: -2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#E84B58',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 9.5, fontWeight: '700', color: '#FFFFFF' },

  label: {
    // 11, not 4: the other tabs' labels start at ~43 within the bar, and the
    // cart's base is higher than their icons' because it is raised. Matching
    // the number would leave this label floating above the row.
    marginTop: 11,
    fontSize: 10,
    letterSpacing: -0.15,
    color: '#65788D',
  },
  labelActive: { color: '#0A96D8', fontWeight: '700' },
});
