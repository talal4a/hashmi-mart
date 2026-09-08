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

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

export const TAB_BAR_HEIGHT = 72;
export const TAB_BAR_GAP = 12;
const INSET = 6;
const SPRING = {
  damping: 26,
  stiffness: 380,
  mass: 0.65,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
} as const;
const TABS = [
  {
    key: 'home',
    label: 'Home',
    icon: Home,
  },
  {
    key: 'categories',
    label: 'Categories',
    icon: LayoutGrid,
  },
  {
    key: 'orders',
    label: 'Orders',
    icon: ClipboardList,
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: User,
  },
] as const;

export type HomeTab = (typeof TABS)[number]['key'];

/* -------------------------------------------------------------------------- */
/*                                    PROPS                                   */
/* -------------------------------------------------------------------------- */

type Props = {
  onChange?: (tab: HomeTab) => void;

  onOpenCart: () => void;

  cartCount: number;

  blurTarget: RefObject<View | null>;

  badges?: Partial<Record<HomeTab, number>>;
};

// The notch is transparent, not a canvas-colored disc covering the glass.
// Blur is confined to the wings and lower bridge so it never fills the cutout.
const GlassBackdrop = memo(function GlassBackdrop({
  width,
  blurTarget,
}: GlassBackdropProps) {
  const middle = width / 2;
  const contour = `M32 1 H${middle - 48} C${middle - 35} 1 ${middle - 38} 34 ${middle} 34 C${middle + 38} 34 ${middle + 35} 1 ${middle + 48} 1 H${width - 32} Q${width - 1} 1 ${width - 1} 32 V40 Q${width - 1} 71 ${width - 32} 71 H32 Q1 71 1 40 V32 Q1 1 32 1 Z`;
  const blur = {
    blurTarget,
    blurMethod: 'dimezisBlurViewSdk31Plus' as const,
    blurReductionFactor: 4,
    tint:
      Platform.OS === 'ios'
        ? ('systemUltraThinMaterialLight' as const)
        : ('light' as const),
    intensity: 45,
  };
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.backdrop]}>
      <BlurView
        {...blur}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: Math.max(0, middle - 48),
        }}
      />
      <BlurView
        {...blur}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: Math.max(0, middle - 48),
        }}
      />
      <BlurView
        {...blur}
        style={{
          position: 'absolute',
          left: middle - 48,
          top: 34,
          bottom: 0,
          width: 96,
        }}
      />

      {/* -------------------------------------------------------------- */}
      {/* GLASS TINT                                                     */}
      {/* -------------------------------------------------------------- */}

      <Svg
        width={width}
        height={TAB_BAR_HEIGHT}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <SvgGradient id="navGlass" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.78} />

            <Stop offset="1" stopColor="#E4F5FF" stopOpacity={0.66} />
          </SvgGradient>
        </Defs>

        <Path
          d={contour}
          fill="url(#navGlass)"
          stroke="#FFFFFF"
          strokeOpacity={0.9}
          strokeWidth={1}
        />
      </Svg>
    </View>
  );
});

/* -------------------------------------------------------------------------- */
/*                             BOTTOM NAVIGATION                              */
/* -------------------------------------------------------------------------- */

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

    const badge = badges?.[tab.key] ?? 0;

    const iconColor = selected ? grocery.blue : '#65788D';

    return (
      <PressableScale
        key={tab.key}

        accessibilityRole="tab"

        accessibilityState={{
          selected,
        }}

        accessibilityLabel={tab.label}

        testID={`home-tab-${tab.key}`}

        scaleTo={0.94}

        style={[styles.tab, selected && styles.selectedTab]}

        onPress={() => {
          setActive(tab.key);

          onChange?.(tab.key);
        }}
      >
        <Animated.View style={iconStyle}>
          <Icon size={23} color={color} strokeWidth={selected ? 2.2 : 1.8} />
          {badge != null && badge > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          )}
        </Animated.View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={[s.label, { color, fontWeight: selected ? '600' : '400' }]}
        >
          {tab.label}
        </Text>
      </Pressable>
    </GestureDetector>
  );
});

/** Keep native blur and its target untouched when React updates tab labels. */
const GlassBackdrop = memo(function GlassBackdrop({
  blurTarget,
}: Pick<Props, 'blurTarget'>) {
  return (
    <>
      <BlurView
        pointerEvents="none"
        blurTarget={blurTarget}
        blurMethod="dimezisBlurViewSdk31Plus"
        blurReductionFactor={4}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterialLight' : 'light'}
        intensity={45}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['#FFFFFF50', '#E4F5FF26', '#FFFFFF38']}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
});

/** One persistent selector; only its transform moves between equally sized tabs. */
export default function HomeBottomNav({ onChange, blurTarget, badges }: Props) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const tabWidth = Math.max(0, (width - INSET * 2) / TABS.length);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const target = useSharedValue(0);
  const position = useSharedValue(0);
  // Gesture worklets start motion immediately. This callback updates only tab
  // semantics/icons; Pressable also provides the accessibility activation path.
  const select = useCallback(
    (index: number) => {
      if (target.value !== index) {
        target.value = index;
        position.value = withSpring(index, SPRING);
      }
      setSelectedIndex(previous => (previous === index ? previous : index));
      onChange?.(TABS[index].key);
    },
    [onChange, position, target],
  );
  useEffect(() => () => cancelAnimation(position), [position]);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * tabWidth }],
  }));
  return (
    <View
      pointerEvents="box-none"

      style={[
        styles.dock,

        {
          bottom: insets.bottom + TAB_BAR_GAP,
        },
      ]}
    >
      <View
        style={styles.bar}

        onLayout={event => {
          setWidth(event.nativeEvent.layout.width);
        }}
      >
        {/* -------------------------------------------------------------- */}
        {/* GLASS / NOTCH BACKGROUND                                      */}
        {/* -------------------------------------------------------------- */}

        <View style={styles.glassLayer}>
          {width > 0 && <GlassBackdrop width={width} blurTarget={blurTarget} />}
        </View>

        {/* -------------------------------------------------------------- */}
        {/* NORMAL NAV TABS                                                */}
        {/* -------------------------------------------------------------- */}

        <View style={styles.tabs}>
          {/* Home + Categories */}

          {TABS.slice(0, 2).map(renderTab)}

          {/* Empty space for center cart */}

          <View pointerEvents="none" style={styles.cartSpacer} />

          {/* Orders + Profile */}

          {TABS.slice(2).map(renderTab)}
        </View>

        {/* -------------------------------------------------------------- */}
        {/* CENTER CART                                                    */}
        {/* -------------------------------------------------------------- */}

        <View pointerEvents="box-none" style={styles.cartSlot}>
          <PressableScale
            accessibilityRole="button"

            accessibilityLabel={`Open cart, ${cartCount} ${
              cartCount === 1 ? 'item' : 'items'
            }`}

            testID="home-cart"

            onPress={onOpenCart}

            scaleTo={0.92}

            style={styles.cartButton}
          >
            <LinearGradient
              colors={['#25BAF0', '#0A96D8']}
              start={{
                x: 0,
                y: 0,
              }}
              end={{
                x: 1,
                y: 1,
              }}
              style={styles.cartFill}
            >
              <ShoppingCart size={25} color="#FFFFFF" strokeWidth={2} />
            </LinearGradient>

            {/* Cart count */}

            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}
          </PressableScale>

          <Text style={styles.cartLabel}>Cart</Text>
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  dock: { position: 'absolute', left: 18, right: 18, alignItems: 'center' },
  shadow: {
    width: '100%',
    maxWidth: 600,
    borderRadius: 34,
    shadowColor: '#345B73',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  pill: {
    height: TAB_BAR_HEIGHT,
    borderRadius: 34,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',

    justifyContent: 'center',

    gap: 4,

    paddingHorizontal: 2,
  },

  selectedTab: {
    backgroundColor: '#FFFFFF70',

    borderWidth: 1,

    borderColor: '#FFFFFFBB',
  },

  iconContainer: {
    position: 'relative',

    alignItems: 'center',

    justifyContent: 'center',
  },

  label: {
    fontSize: 10,

    letterSpacing: -0.15,

    textAlign: 'center',
  },

  /* ---------------------------------------------------------------------- */
  /* CENTER SPACE                                                           */
  /* ---------------------------------------------------------------------- */

  cartSpacer: {
    width: CART_SPACE,
  },

  /* ---------------------------------------------------------------------- */
  /* CART                                                                   */
  /* ---------------------------------------------------------------------- */

  cartSlot: {
    position: 'absolute',

    width: CART_SPACE,

    left: '50%',

    marginLeft: -CART_SPACE / 2,

    top: -TAB_BAR_RISE,

    alignItems: 'center',

    zIndex: 20,
  },

  cartButton: {
    width: 56,

    height: 56,

    borderRadius: 28,

    shadowColor: '#087DAE',

    shadowOpacity: 0.24,

    shadowRadius: 9,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 7,
  },

  cartFill: {
    flex: 1,

    borderRadius: 28,
    borderWidth: 1,

    borderColor: '#FFFFFFB3',

    alignItems: 'center',

    justifyContent: 'center',
  },

  cartLabel: {
    marginTop: 10,

    color: '#167EA7',

    fontSize: 10,

    fontWeight: '600',
  },

  /* ---------------------------------------------------------------------- */
  /* CART BADGE                                                             */
  /* ---------------------------------------------------------------------- */

  cartBadge: {
    position: 'absolute',

    top: -3,

    right: -4,

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

  cartBadgeText: {
    fontSize: 10,

    fontWeight: '700',

    color: '#087FAD',
  },

  /* ---------------------------------------------------------------------- */
  /* NORMAL TAB BADGE                                                       */
  /* ---------------------------------------------------------------------- */

  badge: {
    position: 'absolute',

    top: -7,

    right: -10,

    minWidth: 16,

    height: 16,

    borderRadius: 8,

    paddingHorizontal: 3,

    backgroundColor: '#E84B58',

    alignItems: 'center',

    justifyContent: 'center',
  },

  badgeText: {
    fontSize: 9,

    fontWeight: '700',

    color: '#FFFFFF',
  },
});
