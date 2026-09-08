import { memo, useState, type RefObject } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Stop,
} from 'react-native-svg';
import {
  Home,
  LayoutGrid,
  ClipboardList,
  User,
  ShoppingCart,
} from 'lucide-react-native';
import PressableScale from '../ui/PressableScale';
import { grocery } from './groceryTheme';

export const TAB_BAR_HEIGHT = 72;
export const TAB_BAR_GAP = 12;
export const TAB_BAR_RISE = 24;
const CART_SPACE = 76;

/** Matches the corner radius baked into the `contour` path's Q curves below. */
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

/**
 * The bar's frosted surface, drawn as one silhouette.
 *
 * The blur is a single rectangle covering the whole bar, with the contour path
 * painted over it. It used to be three rectangles — left wing, right wing, and
 * a bridge starting at y=34 — arranged to keep the blur out of the notch. That
 * left a gap the shape of the problem: the contour dips from y=1 at the edges
 * of the cutout down to y=34 at the centre, so between the curve and the
 * bridge's flat top there were two crescents, 33px tall at their widest, that
 * had the glass fill over them but no blur behind. Sharp photo through a thin
 * white film on either side of the cart, blurred photo through the same film
 * everywhere else — the difference read as the curve being a different colour
 * from the rest of the bar.
 *
 * A rectangle cannot follow a curved edge, and stacking more rectangles only
 * makes the seam smaller, never straight. Blurring the whole bar and letting
 * the path decide where the glass *fill* goes removes the mismatch entirely,
 * and costs one native blur pass instead of three.
 *
 * The trade-off is that the cutout is no longer see-through: it shows blurred
 * background rather than the page itself. Around a cart button that covers most
 * of it, that reads as the glass dipping — which is the intent. A true
 * transparent hole needs the blur masked to the path
 * (`@react-native-masked-view/masked-view`), which is a native dependency and a
 * rebuild; worth it only if the cutout has to be genuinely clear.
 */
const GlassBackdrop = memo(function GlassBackdrop({
  width,
  blurTarget,
}: {
  width: number;
  blurTarget: RefObject<View | null>;
}) {
  const middle = width / 2;
  const contour = `M32 1 H${middle - 48} C${middle - 35} 1 ${middle - 38} 34 ${middle} 34 C${middle + 38} 34 ${middle + 35} 1 ${middle + 48} 1 H${width - 32} Q${width - 1} 1 ${width - 1} 32 V40 Q${width - 1} 71 ${width - 32} 71 H32 Q1 71 1 40 V32 Q1 1 32 1 Z`;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.backdrop]}>
      {/*
        Rounded on the view itself, not just on the parent. On Android
        `dimezisBlurViewSdk31Plus` is a real native view doing a
        hardware-accelerated pass and it ignores an ancestor's `overflow:
        hidden`, so without this it paints square into the corners.
      */}
      <BlurView
        blurTarget={blurTarget}
        blurMethod="dimezisBlurViewSdk31Plus"
        blurReductionFactor={4}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterialLight' : 'light'}
        intensity={45}
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: BAR_RADIUS, overflow: 'hidden' },
        ]}
      />
      <Svg width={width} height={TAB_BAR_HEIGHT}>
        <Defs>
          <SvgGradient id="nav-glass" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.78} />
            <Stop offset="1" stopColor="#E4F5FF" stopOpacity={0.66} />
          </SvgGradient>
        </Defs>
        <Path
          d={contour}
          fill="url(#nav-glass)"
          stroke="#FFFFFF"
          strokeOpacity={0.9}
          strokeWidth={1}
        />
      </Svg>
    </View>
  );
});

export default function HomeBottomNav({
  onChange,
  onOpenCart,
  cartCount,
  blurTarget,
  badges,
}: Props) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
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
        <View style={[s.tabContent, selected && s.selectedTab]}>
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
      <View
        style={s.bar}
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
      >
        {width > 0 ? (
          <GlassBackdrop width={width} blurTarget={blurTarget} />
        ) : null}
        <View style={s.tabs}>
          {TABS.slice(0, 2).map(renderTab)}
          <View style={{ width: CART_SPACE }} pointerEvents="none" />
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
              <ShoppingCart size={25} color="#FFFFFF" strokeWidth={2} />
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
  backdrop: { borderRadius: BAR_RADIUS, overflow: 'hidden' },
  tabs: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
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
  selectedTab: { backgroundColor: '#FFFFFF70', borderColor: '#FFFFFFBB' },
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
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#087DAE',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  cartFill: {
    flex: 1,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFFB3',
  },
  cartLabel: {
    marginTop: 12,
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
