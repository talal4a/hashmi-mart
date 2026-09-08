import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Minus, Plus } from 'lucide-react-native';
import type { freshPicks } from '../../data/groceryHome';
import ProduceArt from './ProduceArt';
import { useCartFlight } from './cartFlight';
import { grocery as c } from './groceryTheme';

export const PRODUCT_CARD_WIDTH = 178;

type Product = (typeof freshPicks)[number];

const press = { damping: 17, stiffness: 300, mass: 0.5 };
const pop = { damping: 12, stiffness: 340, mass: 0.5 };

const STEPPER_COLLAPSED = 34;
// Wide enough for minus / count / plus, narrow enough that the price beside
// it still has room at the card's smallest width.
const STEPPER_EXPANDED = 82;

/** Round "+" that grows into a quantity stepper once the item is in the cart. */
function AddControl({
  label,
  quantity,
  onAdjust,
  artRef,
  art,
}: {
  label: string;
  quantity?: number;
  onAdjust?: (delta: number) => void;
  /** The card's illustration, so the flight can start from what was tapped. */
  artRef?: React.RefObject<View | null>;
  art?: number;
}) {
  const [localQty, setQty] = useState(0);
  const qty = quantity ?? localQty;
  const { fly } = useCartFlight();

  /**
   * Sends a copy of the card's artwork to the cart.
   *
   * Measured at the moment of the tap rather than on layout: this card lives in
   * a horizontal rail, so where it is on screen depends on how far that rail
   * has been scrolled. A position captured at mount is wrong as soon as anyone
   * swipes.
   *
   * Only on the way up. Removing an item does not throw anything anywhere.
   */
  const launch = () => {
    const node = artRef?.current;
    if (!node || art === undefined) return;
    node.measureInWindow((x, y, width, height) => {
      if (width <= 0) return;
      fly({
        x: x + width / 2,
        y: y + height / 2,
        size: Math.min(46, width * 0.55),
        art,
      });
    });
  };

  const adjust = (delta: number) => {
    if (delta > 0) launch();
    if (onAdjust) onAdjust(delta);
    else setQty(value => Math.max(0, value + delta));
  };
  const reducedMotion = useReducedMotion();
  const open = useSharedValue(0);
  const bump = useSharedValue(1);

  useEffect(() => {
    const target = qty > 0 ? 1 : 0;
    open.value = reducedMotion
      ? target
      : withSpring(target, { damping: 18, stiffness: 220, mass: 0.6 });
  }, [qty, reducedMotion, open]);

  const punch = useCallback(() => {
    if (reducedMotion) return;
    bump.value = withSequence(
      withTiming(0.86, { duration: 90 }),
      withSpring(1, pop),
    );
  }, [reducedMotion, bump]);

  const shell = useAnimatedStyle(() => ({
    width:
      STEPPER_COLLAPSED + (STEPPER_EXPANDED - STEPPER_COLLAPSED) * open.value,
    transform: [{ scale: bump.value }],
  }));
  const plusOnly = useAnimatedStyle(() => ({
    opacity: 1 - open.value,
    transform: [{ scale: 0.7 + 0.3 * (1 - open.value) }],
  }));
  const stepper = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: [{ scale: 0.8 + 0.2 * open.value }],
  }));

  return (
    <Animated.View style={[a.shell, shell]}>
      <LinearGradient
        colors={['#25C0F5', '#0A93D4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Collapsed state: one tap target covering the whole pill. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, a.centre, plusOnly]}
        pointerEvents={qty > 0 ? 'none' : 'auto'}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${label} to cart`}
          onPress={() => {
            punch();
            adjust(1);
          }}
          hitSlop={6}
          style={[StyleSheet.absoluteFill, a.centre]}
        >
          <Plus size={20} color={c.white} strokeWidth={2.6} />
        </Pressable>
      </Animated.View>

      {/* Expanded state: minus / count / plus. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, a.stepper, stepper]}
        pointerEvents={qty > 0 ? 'auto' : 'none'}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove one ${label}`}
          onPress={() => {
            punch();
            adjust(-1);
          }}
          hitSlop={4}
          style={a.step}
        >
          <Minus size={15} color={c.white} strokeWidth={3} />
        </Pressable>
        <Text style={a.qty} accessibilityLabel={`${qty} in cart`}>
          {Math.max(qty, 1)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add another ${label}`}
          onPress={() => {
            punch();
            adjust(1);
          }}
          hitSlop={4}
          style={a.step}
        >
          <Plus size={15} color={c.white} strokeWidth={3} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/** Save toggle: the heart springs past its resting size, then settles filled. */
function SaveButton({ label }: { label: string }) {
  const [saved, setSaved] = useState(false);
  const reducedMotion = useReducedMotion();
  const beat = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: beat.value }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: saved }}
      accessibilityLabel={`Save ${label}`}
      hitSlop={8}
      onPress={() => {
        setSaved(v => !v);
        if (!reducedMotion) {
          beat.value = withSequence(
            withTiming(0.8, { duration: 80 }),
            withSpring(1, pop),
          );
        }
      }}
      style={p.heart}
    >
      <Animated.View style={style}>
        <Heart
          size={17}
          color={saved ? '#FF4D67' : '#8E9EB2'}
          fill={saved ? '#FF4D67' : 'transparent'}
          strokeWidth={2.1}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function FreshProductCard({
  item,
  width = PRODUCT_CARD_WIDTH,
  quantity,
  onAdjust,
}: {
  item: Product;
  width?: number;
  quantity?: number;
  onAdjust?: (delta: number) => void;
}) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const art = useSharedValue(1);
  // Measured on tap so the flight leaves from the artwork the user pressed
  // beside, wherever the rail has been scrolled to.
  const artRef = useRef<View>(null);

  const card = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const artStyle = useAnimatedStyle(() => ({
    transform: [{ scale: art.value }],
  }));

  const dip = (down: boolean) => {
    if (reducedMotion) return;
    scale.value = withSpring(down ? 0.97 : 1, press);
    // The photo pushes forward inside its well: depth, not just a shrink.
    art.value = withSpring(down ? 1.06 : 1, press);
  };

  const wellSize = width - 20;

  return (
    <Animated.View style={card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.meta}, Rs. ${item.price}${item.was ? `, reduced from Rs. ${item.was}` : ''}`}
        onPressIn={() => dip(true)}
        onPressOut={() => dip(false)}
        style={[p.card, { width }]}
      >
        <View style={[p.well, { height: wellSize }]}>
          <LinearGradient
            colors={['#F2FBFF', '#E3F4FC']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View ref={artRef} collapsable={false} style={artStyle}>
            <ProduceArt index={item.art} size={wellSize} radius={18} />
          </Animated.View>

          {item.discount ? (
            <LinearGradient
              colors={['#2FB463', '#158A45']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={p.discount}
            >
              <Text style={p.discountText}>{item.discount}%</Text>
              <Text style={p.discountOff}>OFF</Text>
            </LinearGradient>
          ) : null}

          <SaveButton label={item.name} />
        </View>

        <View style={p.body}>
          <Text numberOfLines={1} style={p.meta}>
            {item.meta}
          </Text>
          <Text numberOfLines={1} style={p.name}>
            {item.name}
          </Text>

          <View style={p.footer}>
            <View style={p.priceBlock}>
              <Text style={p.price}>Rs. {item.price}</Text>
              {item.was ? <Text style={p.was}>Rs. {item.was}</Text> : null}
            </View>
            <AddControl
              label={item.name}
              quantity={quantity}
              onAdjust={onAdjust}
              artRef={artRef}
              art={item.art}
            />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const p = StyleSheet.create({
  card: {
    backgroundColor: c.white,
    borderRadius: 22,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EDF3F7',
    shadowColor: '#2B4E60',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  well: {
    borderRadius: 18,
    backgroundColor: c.pale,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discount: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  discountText: { color: c.white, fontSize: 11, fontWeight: '800' },
  discountOff: {
    color: '#D6F4E0',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heart: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 28,
    height: 28,
    borderRadius: 15,
    backgroundColor: '#FFFFFFEE',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2B4E60',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  body: { paddingHorizontal: 2, paddingTop: 9, gap: 1 },
  meta: { color: c.muted, fontSize: 10, letterSpacing: -0.1 },
  name: {
    color: c.ink,
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  priceBlock: { flex: 1, minWidth: 0 },
  price: {
    color: c.ink,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  was: {
    color: '#93A2B3',
    fontSize: 11,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
});

const a = StyleSheet.create({
  shell: {
    height: STEPPER_COLLAPSED,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#0A93D4',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  centre: { alignItems: 'center', justifyContent: 'center' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  step: {
    width: 24,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: {
    color: c.white,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 16,
    textAlign: 'center',
  },
});
