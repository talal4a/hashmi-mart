import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ShoppingCart } from 'lucide-react-native';
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

/**
 * The centre cart: model, pedestal, contact shadow, badge and label.
 *
 * Built as one component with fixed bounds because every part of it depends on
 * every other part. The pedestal has to sit under the model, the contact shadow
 * has to touch the wheels, the badge has to clear the basket, and the label has
 * to clear the notch — all in the same coordinate space. Split across the nav
 * bar's style sheet, those relationships are five numbers that drift apart.
 *
 * The model is the one thing this file does not draw. `CART_ART` is the seam
 * for a transparent render; until one exists, a cyan glyph stands in at the
 * same size and position, so scale, anchoring and motion are all correct and
 * dropping the artwork in changes nothing else.
 */

/**
 * A transparent render of the cart, when there is one.
 *
 * Replace with `require('../../assets/images/cart-3d.webp')`. The size and
 * position below are already correct for it, and nothing else needs to change.
 * It must be a local asset — fetching it would mean the bar renders without a
 * cart on a cold start, which is the layout shift this component is shaped to
 * avoid.
 */
const CART_ART: number | null = null;

/** Height of an ordinary nav icon, which everything here is measured against. */
export const NAV_ICON = 22;

/**
 * The model's drawn height.
 *
 * 1.8x a nav icon. The brief asks for 1.6x-1.9x and the previous 58px circle
 * was 2.6x, which is what made it read as pasted on rather than belonging to
 * the row.
 */
const MODEL = Math.round(NAV_ICON * 1.8);

/**
 * How far the model stands above the bar's top edge.
 *
 * 14 of 40 is 35% — inside the 30-40% the brief asks for. The majority of the
 * cart is inside the nav, which is the difference between a control that lives
 * in the bar and a trolley floating over the page.
 */
export const CART_RISE = 14;

const PEDESTAL_W = 54;
const PEDESTAL_H = 30;
const SHADOW_W = 30;
const SHADOW_H = 7;

/** Total height the slot reserves, so the bar's layout never depends on load. */
export const CART_SLOT_HEIGHT = CART_RISE + MODEL + 22;

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
   * Deliberately below the threshold where it becomes an animation you watch.
   * The delay is most of the cycle, so the movement arrives as something
   * noticed rather than a rhythm — a cart that bobs continuously reads as a
   * loading state.
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

  // The badge answers the count changing, not the cart being tapped: an item
  // added from a product card has to be acknowledged here too.
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

  // The shadow tightens as the cart settles onto it and spreads as it lifts,
  // which is most of what sells the contact.
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + 0.06 * press.value - 0.04 * float.value,
    transform: [{ scaleX: 1 - 0.08 * float.value + 0.06 * press.value }],
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
        {/* Pedestal, contact shadow, model — back to front, so the shadow
            falls on the pedestal and the model stands on both. */}
        <View
          pointerEvents="none"
          style={[s.pedestal, active && s.pedestalActive]}
        />
        <Animated.View pointerEvents="none" style={[s.shadow, shadowStyle]} />

        <Animated.View style={[s.model, modelStyle]} pointerEvents="none">
          {CART_ART ? (
            <Animated.Image
              source={CART_ART}
              style={s.art}
              resizeMode="contain"
              // Decoded at a fixed size, so nothing resizes after load.
              fadeDuration={0}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <ShoppingCart
              size={MODEL - 6}
              color="#0A96D8"
              strokeWidth={1.9}
              absoluteStrokeWidth
            />
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
  // Fixed height, reserved from the first frame whether or not artwork loads.
  slot: { height: CART_SLOT_HEIGHT, alignItems: 'center' },
  hit: {
    width: PEDESTAL_W + 12,
    height: CART_RISE + MODEL + 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  pedestal: {
    position: 'absolute',
    bottom: 0,
    width: PEDESTAL_W,
    height: PEDESTAL_H,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#2C6B87',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pedestalActive: {
    backgroundColor: 'rgba(214, 242, 253, 0.82)',
    borderColor: 'rgba(255, 255, 255, 1)',
  },

  // A flat ellipse right under the wheels. Small and soft on purpose: a large
  // shadow reads as the cart hovering, which is the opposite of the point.
  shadow: {
    position: 'absolute',
    bottom: 8,
    width: SHADOW_W,
    height: SHADOW_H,
    borderRadius: SHADOW_H,
    backgroundColor: '#0B4A63',
  },

  model: {
    marginBottom: 6,
    width: MODEL,
    height: MODEL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: { width: MODEL, height: MODEL },

  // Upper right, clear of the basket mouth so it never covers the geometry
  // that makes the cart readable.
  badge: {
    position: 'absolute',
    top: 0,
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
    marginTop: 4,
    fontSize: 10,
    letterSpacing: -0.15,
    color: '#65788D',
  },
  labelActive: { color: '#0A96D8', fontWeight: '700' },
});
