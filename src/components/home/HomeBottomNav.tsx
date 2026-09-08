import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  runOnJS,
  useDerivedValue,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  Home,
  LayoutGrid,
  Store,
  ClipboardList,
  User,
} from 'lucide-react-native';
import { grocery } from './groceryTheme';

export const TAB_BAR_HEIGHT = 72;
export const TAB_BAR_GAP = 12;
const INSET = 6;

/**
 * The pill's corner radius, in one place because four layers have to agree on
 * it. They stack — blur, gradient, tint, hairline border — and a corner where
 * one of them rounds differently from the rest is visible as a colour seam
 * rather than as a wrong radius.
 */
const PILL_RADIUS = 34;
const SPRING = {
  damping: 26,
  stiffness: 380,
  mass: 0.65,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
} as const;
const TABS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'categories', label: 'Categories', icon: LayoutGrid },
  { key: 'stores', label: 'Stores', icon: Store },
  { key: 'orders', label: 'Orders', icon: ClipboardList },
  { key: 'profile', label: 'Profile', icon: User },
] as const;
export type HomeTab = (typeof TABS)[number]['key'];
type Props = {
  onChange?: (tab: HomeTab) => void;
  blurTarget: RefObject<View | null>;
  badges?: Partial<Record<HomeTab, number>>;
};

const TabItem = memo(function TabItem({
  tab,
  index,
  selected,
  select,
  badge,
  target,
  position,
}: {
  tab: (typeof TABS)[number];
  index: number;
  selected: boolean;
  select: (index: number) => void;
  badge?: number;
  target: SharedValue<number>;
  position: SharedValue<number>;
}) {
  const press = useSharedValue(1);
  const focus = useDerivedValue(() =>
    withSpring(target.value === index ? 1.08 : 1, SPRING),
  );
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: focus.value * press.value }],
  }));
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(12)
        .onBegin(() => {
          press.value = withSpring(0.94, SPRING);
        })
        .onEnd((_, success) => {
          if (success && target.value !== index) {
            target.value = index;
            position.value = withSpring(index, SPRING);
            runOnJS(select)(index);
          }
        })
        .onFinalize(() => {
          press.value = withSpring(1, SPRING);
        }),
    [index, position, press, select, target],
  );
  useEffect(() => () => cancelAnimation(press), [press]);
  const Icon = tab.icon;
  const color = selected ? grocery.blue : '#65788D';
  return (
    <GestureDetector gesture={tap}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={`${tab.label}${badge && badge > 0 ? `, ${badge} unread` : ''}`}
        testID={`home-tab-${tab.key}`}
        onPress={() => select(index)}
        style={s.tab}
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
      {/*
        Each layer rounds itself rather than trusting the parent to clip it.
        On Android the blur is a real native view doing a hardware-accelerated
        pass, and it does not honour an ancestor's `overflow: hidden` with a
        border radius — so it painted square into all four corners while the
        pill's own tint clipped round. The result was a corner that was a
        visibly different colour from the middle of the bar. `overflow` stays
        on both as belt and braces for the gradient, which does clip.
      */}
      <BlurView
        pointerEvents="none"
        blurTarget={blurTarget}
        blurMethod="dimezisBlurViewSdk31Plus"
        blurReductionFactor={4}
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterialLight' : 'light'}
        intensity={45}
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: PILL_RADIUS, overflow: 'hidden' },
        ]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['#FFFFFF50', '#E4F5FF26', '#FFFFFF38']}
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: PILL_RADIUS, overflow: 'hidden' },
        ]}
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
      style={[s.dock, { bottom: insets.bottom + TAB_BAR_GAP }]}
    >
      <View style={s.shadow}>
        <View
          style={s.pill}
          onLayout={event => setWidth(event.nativeEvent.layout.width)}
        >
          <GlassBackdrop blurTarget={blurTarget} />
          {width > 0 && (
            <Animated.View
              pointerEvents="none"
              renderToHardwareTextureAndroid
              testID="home-tab-indicator"
              style={[s.indicator, { width: tabWidth }, indicatorStyle]}
            >
              <LinearGradient
                colors={['#FFFFFFA6', '#C7EBFB75', '#FFFFFF60']}
                style={s.activeGlass}
              />
            </Animated.View>
          )}
          {TABS.map((tab, index) => (
            <TabItem
              key={tab.key}
              tab={tab}
              index={index}
              selected={selectedIndex === index}
              select={select}
              target={target}
              position={position}
              badge={badges?.[tab.key]}
            />
          ))}
        </View>
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: PILL_RADIUS,
              borderWidth: 1,
              borderColor: '#FFFFFFA8',
            },
          ]}
        />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  dock: { position: 'absolute', left: 18, right: 18, alignItems: 'center' },
  shadow: {
    width: '100%',
    maxWidth: 600,
    borderRadius: PILL_RADIUS,
    shadowColor: '#345B73',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  pill: {
    height: TAB_BAR_HEIGHT,
    borderRadius: PILL_RADIUS,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: INSET,
    backgroundColor: '#EAF8FF18',
  },
  indicator: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: INSET,
    paddingHorizontal: 1,
  },
  activeGlass: {
    flex: 1,
    // Concentric with the pill: an inner corner inset by `n` from an outer
    // radius `r` sits right only at `r - n`. Derived rather than written as 28,
    // so changing the pill's roundness cannot leave the selector square-ish at
    // the first and last tab.
    borderRadius: PILL_RADIUS - INSET,
    borderWidth: 1,
    borderColor: '#FFFFFFD9',
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 1,
  },
  label: { fontSize: 10, letterSpacing: -0.15 },
  badge: {
    position: 'absolute',
    top: -7,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: '#FF4B4B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: 'white', fontSize: 9, fontWeight: '600' },
});
