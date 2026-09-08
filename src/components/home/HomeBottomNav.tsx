import { useState, type RefObject } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ClipboardList,
  Home,
  LayoutGrid,
  ShoppingCart,
  User,
} from 'lucide-react-native';
import PressableScale from '../ui/PressableScale';
import { grocery } from './groceryTheme';

/**
 * The floating tab bar, with the cart raised out of its centre.
 *
 * The surface is a rounded rectangle, not an SVG silhouette with a notch cut
 * into it. That is a deliberate step back from the previous version, which
 * broke in three different ways for the same underlying reason: the shape was
 * described by a path built from a measured width, while the frosting behind it
 * was described by rectangles. Those two can never agree along a curve. The
 * visible symptom was a pair of crescents beside the cart carrying the glass
 * tint with no blur behind them — 33px tall at their widest, which is why the
 * curve read as a different colour from the rest of the bar.
 *
 * A rectangle can be clipped, blurred, tinted and bordered by four layers that
 * all round the same way, so the bar is one uniform colour everywhere by
 * construction rather than by careful alignment.
 *
 * The cart still reads as sitting *in* the bar rather than on it: it is raised
 * above the top edge and carries a solid white ring, so the bar appears to
 * cradle it. That effect costs one border instead of a path, a mask and three
 * blur passes.
 *
 * The surface also has its own `backgroundColor`. The blur sits on top of it,
 * so when blurring works the colour is invisible — and when it does not (an
 * unsupported device, a failed `blurTarget`), the bar is still a bar rather
 * than a row of icons floating over the page, which is what the previous
 * version degraded to.
 */

export const TAB_BAR_HEIGHT = 72;
export const TAB_BAR_GAP = 12;
/** How far the cart button stands proud of the bar. Home reads this for spacing. */
export const TAB_BAR_RISE = 24;

/** The gap left in the tab row for the cart to sit in. */
const CART_SPACE = 82;

/** One radius for every layer of the surface, so none of them can disagree. */
const BAR_RADIUS = 32;

const TABS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'categories', label: 'Categories', icon: LayoutGrid },
  { key: 'orders', label: 'Orders', icon: ClipboardList },
  { key: 'profile', label: 'Profile', icon: User },
] as const;

export type HomeTab = (typeof TABS)[number]['key'];

type Props = {
  onChange?: (tab: HomeTab) => void;
  onOpenCart: () => void;
  cartCount: number;
  blurTarget: RefObject<View | null>;
  badges?: Partial<Record<HomeTab, number>>;
};

export default function HomeBottomNav({
  onChange,
  onOpenCart,
  cartCount,
  blurTarget,
  badges,
}: Props) {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<HomeTab>('home');

  const renderTab = (tab: (typeof TABS)[number]) => {
    const selected = active === tab.key;
    const Icon = tab.icon;
    const color = selected ? grocery.blue : '#65788D';
    const badge = badges?.[tab.key] ?? 0;

    return (
      <PressableScale
        key={tab.key}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={tab.label}
        testID={`home-tab-${tab.key}`}
        scaleTo={0.94}
        style={s.tab}
        onPress={() => {
          setActive(tab.key);
          onChange?.(tab.key);
        }}
      >
        <View style={[s.tabContent, selected && s.tabSelected]}>
          <View>
            <Icon size={22} color={color} strokeWidth={selected ? 2.2 : 1.8} />
            {badge > 0 ? (
              <View style={s.badge}>
                <Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text>
              </View>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={[s.label, { color, fontWeight: selected ? '600' : '400' }]}
          >
            {tab.label}
          </Text>
        </View>
      </PressableScale>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={[s.dock, { bottom: insets.bottom + TAB_BAR_GAP }]}
    >
      {/* No `overflow: hidden` here — the cart rises past the top edge and
          would be clipped by it. The surface below clips itself instead. */}
      <View pointerEvents="box-none" style={s.bar}>
        <View pointerEvents="none" style={s.surface}>
          {/*
            Each layer rounds itself rather than trusting the parent. On Android
            `dimezisBlurViewSdk31Plus` is a real native view doing a
            hardware-accelerated pass, and it ignores an ancestor's `overflow:
            hidden`, so without its own radius it paints square into the corners.
          */}
          <BlurView
            blurTarget={blurTarget}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurReductionFactor={4}
            tint={
              Platform.OS === 'ios' ? 'systemUltraThinMaterialLight' : 'light'
            }
            intensity={45}
            style={s.layer}
          />
          <LinearGradient
            colors={['#FFFFFFB8', '#E8F6FF9E', '#FFFFFFA6']}
            style={s.layer}
          />
        </View>

        <View style={s.tabs}>
          {TABS.slice(0, 2).map(renderTab)}
          <View pointerEvents="none" style={s.cartSpacer} />
          {TABS.slice(2).map(renderTab)}
        </View>

        <View pointerEvents="box-none" style={s.cartSlot}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Open cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
            testID="home-cart"
            onPress={onOpenCart}
            scaleTo={0.94}
            style={s.cartButton}
          >
            <LinearGradient colors={['#25BAF0', '#0A96D8']} style={s.cartFill}>
              <ShoppingCart size={24} color="#FFFFFF" strokeWidth={2} />
            </LinearGradient>
            {cartCount > 0 ? (
              <View style={s.cartBadge}>
                <Text style={s.cartBadgeText}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            ) : null}
          </PressableScale>
          <Text style={s.cartLabel}>Cart</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  dock: { position: 'absolute', left: 18, right: 18, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 600, height: TAB_BAR_HEIGHT },

  surface: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
    // The fallback under the blur. Elevation with no background draws nothing
    // on Android, which is how the bar ended up invisible before.
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#345B73',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
  },

  tabs: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  cartSpacer: { width: CART_SPACE },
  tab: { flex: 1, height: 64, justifyContent: 'center' },
  tabContent: {
    height: 56,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  label: { fontSize: 10, letterSpacing: -0.15 },

  cartSlot: {
    position: 'absolute',
    width: CART_SPACE,
    left: '50%',
    marginLeft: -CART_SPACE / 2,
    top: -TAB_BAR_RISE,
    alignItems: 'center',
  },
  cartButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    // The ring. A solid rim is what makes the bar look like it cradles the
    // cart, and it is what a notch was being cut for.
    backgroundColor: '#FFFFFF',
    padding: 3,
    shadowColor: '#087DAE',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 9,
  },
  cartFill: {
    flex: 1,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartLabel: {
    marginTop: 6,
    color: '#167EA7',
    fontSize: 10,
    fontWeight: '600',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -3,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C4ECFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { fontSize: 10, fontWeight: '700', color: '#087FAD' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E84B58',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 9, color: '#FFFFFF' },
});
