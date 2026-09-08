import { useState, type RefObject } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { ClipboardList, Home, LayoutGrid, User } from 'lucide-react-native';
import PressableScale from '../ui/PressableScale';
import CartTab, { CART_RISE } from './CartTab';
import { grocery } from './groceryTheme';

export const TAB_BAR_HEIGHT = 72;
export const TAB_BAR_GAP = 12;

/** The cart owns this; re-exported so Home has one number to space against. */
export const TAB_BAR_RISE = CART_RISE;

/**
 * Width reserved for the cart. Matched to the notch mouth so no tab pill can be
 * drawn half over the cutout, and close enough to a normal tab's width that the
 * five slots still read as evenly spaced.
 */
const CART_SPACE = 100;

const R = 28;

const NOTCH_HALF = 50;

/**
 * Shallower than before, because the cart is smaller and sits lower. A 40-deep
 * cutout under a model that rises 14px above the bar is a hole with nothing in
 * it; 22 keeps a visible cradle and leaves the pedestal — not the cutout — as
 * what the cart stands on.
 */
const NOTCH_DEPTH = 22;

function silhouette(width: number): string {
  const cx = width / 2;
  const H = TAB_BAR_HEIGHT;
  return [
    `M ${R} 0`,
    `H ${cx - NOTCH_HALF}`,
    `C ${cx - 32} 0 ${cx - 38} ${NOTCH_DEPTH} ${cx} ${NOTCH_DEPTH}`,
    `C ${cx + 38} ${NOTCH_DEPTH} ${cx + 32} 0 ${cx + NOTCH_HALF} 0`,
    `H ${width - R}`,
    `Q ${width} 0 ${width} ${R}`,
    `V ${H - R}`,
    `Q ${width} ${H} ${width - R} ${H}`,
    `H ${R}`,
    `Q 0 ${H} 0 ${H - R}`,
    `V ${R}`,
    `Q 0 0 ${R} 0`,
    'Z',
  ].join(' ');
}

const TABS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'categories', label: 'Categories', icon: LayoutGrid },
  { key: 'orders', label: 'Orders', icon: ClipboardList },
  { key: 'profile', label: 'Profile', icon: User },
] as const;

export type HomeTab = (typeof TABS)[number]['key'] | 'cart';

type Props = {
  onChange?: (tab: HomeTab) => void;
  onOpenCart: () => void;
  cartCount: number;
  blurTarget?: RefObject<View | null>;
  badges?: Partial<Record<HomeTab, number>>;
};

export default function HomeBottomNav({
  onChange,
  onOpenCart,
  cartCount,
  badges,
}: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [active, setActive] = useState<HomeTab>('home');
  const [width, setWidth] = useState(() =>
    Math.min(600, Math.max(0, window.width - 36)),
  );

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
      <View
        pointerEvents="box-none"
        style={s.bar}
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
      >
        <Svg
          pointerEvents="none"
          width={width}
          height={TAB_BAR_HEIGHT}
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <SvgGradient id="navSurface" x1="0" y1="0" x2="0" y2="1">
              {/*
                Near-opaque on purpose. At 0.9 the page still reads through the
                bar — vendor names and section headings were legible behind the
                tabs, which turns the bottom of the screen into two competing
                layers. Glass should say "there is something behind this", not
                let you read it.
              */}
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.985} />
              <Stop offset="0.55" stopColor="#F6FCFF" stopOpacity={0.97} />
              <Stop offset="1" stopColor="#E4F3FC" stopOpacity={0.96} />
            </SvgGradient>
          </Defs>
          <Path
            d={silhouette(width)}
            fill="url(#navSurface)"
            stroke="#FFFFFF"
            strokeOpacity={0.95}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        </Svg>

        <View style={s.tabs}>
          {TABS.slice(0, 2).map(renderTab)}
          <View pointerEvents="none" style={s.cartSpacer} />
          {TABS.slice(2).map(renderTab)}
        </View>

        <View pointerEvents="box-none" style={s.cartSlot}>
          <CartTab
            count={cartCount}
            active={active === 'cart'}
            onPress={() => {
              setActive('cart');
              onOpenCart();
            }}
          />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  dock: { position: 'absolute', left: 18, right: 18, alignItems: 'center' },
  // No `overflow: hidden` — the cart rises past the top edge.
  bar: { width: '100%', maxWidth: 600, height: TAB_BAR_HEIGHT },

  tabs: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  cartSpacer: { width: CART_SPACE },
  tab: { flex: 1, height: 64, justifyContent: 'center' },
  tabContent: {
    height: 54,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderColor: 'rgba(255, 255, 255, 0.95)',
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
