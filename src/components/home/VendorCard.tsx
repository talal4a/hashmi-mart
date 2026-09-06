import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck, Bike, Star, Timer } from 'lucide-react-native';
import type { nearbyVendors } from '../../data/groceryHome';
import { grocery as c } from './groceryTheme';

export const VENDOR_CARD_WIDTH = 240;

type Vendor = (typeof nearbyVendors)[number];

const press = { damping: 17, stiffness: 300, mass: 0.5 };

/** A slow breathing halo behind the "open now" dot — one shop-is-live signal. */
function LiveDot({ open }: { open: boolean }) {
  const pulse = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open || reducedMotion) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [open, reducedMotion, pulse]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.9 }],
  }));

  return (
    <View style={s.liveDotWrap}>
      {open ? <Animated.View style={[s.liveHalo, halo]} /> : null}
      <View
        style={[s.liveDot, { backgroundColor: open ? '#14A571' : '#B4C0CC' }]}
      />
    </View>
  );
}

export default function VendorCard({ item }: { item: Vendor }) {
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  const card = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: lift.value }],
  }));

  const dip = (down: boolean) => {
    if (reducedMotion) return;
    scale.value = withSpring(down ? 0.965 : 1, press);
    lift.value = withSpring(down ? 2 : 0, press);
  };

  return (
    <Animated.View style={card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.kinds}. Rated ${item.rating} from ${item.reviews} reviews. ${item.time} away, ${item.distance}. ${item.delivery}. ${item.open ? 'Open now' : 'Currently closed'}`}
        onPressIn={() => dip(true)}
        onPressOut={() => dip(false)}
        style={[s.card, { width: VENDOR_CARD_WIDTH }]}
      >
        <View style={s.top}>
          <LinearGradient
            colors={[item.color, item.colorDark]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.logo}
          >
            <Text style={s.mark}>{item.mark}</Text>
          </LinearGradient>

          <View style={s.headings}>
            <View style={s.nameRow}>
              <Text numberOfLines={1} style={s.name}>
                {item.name}
              </Text>
              <BadgeCheck size={14} color="#FFFFFF" fill="#0EA5E9" />
            </View>
            <Text numberOfLines={1} style={s.kinds}>
              {item.kinds}
            </Text>
            <View style={s.statusRow}>
              <LiveDot open={item.open} />
              <Text
                style={[s.status, { color: item.open ? '#14A571' : '#8A98A6' }]}
              >
                {item.open ? 'Open now' : 'Opens 9:00 AM'}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.metrics}>
          <View style={s.ratingPill}>
            <Star size={11} color="#F5A623" fill="#F5A623" />
            <Text style={s.ratingValue}>{item.rating}</Text>
            <Text style={s.ratingCount}>({item.reviews})</Text>
          </View>
          <View style={s.divider} />
          <View style={s.metric}>
            <Timer size={12} color={c.muted} strokeWidth={2} />
            <Text style={s.metricText}>{item.time}</Text>
          </View>
          <View style={s.divider} />
          <Text style={s.metricText}>{item.distance}</Text>
        </View>

        <View
          style={[
            s.delivery,
            { backgroundColor: item.free ? '#E8F8F0' : '#F2F5F8' },
          ]}
        >
          <Bike
            size={13}
            color={item.free ? '#14A571' : c.muted}
            strokeWidth={2}
          />
          <Text
            style={[s.deliveryText, { color: item.free ? '#0F8C60' : c.muted }]}
          >
            {item.delivery}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: c.white,
    borderRadius: 22,
    padding: 13,
    gap: 11,
    borderWidth: 1,
    borderColor: '#EDF3F7',
    shadowColor: '#2B4E60',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  top: { flexDirection: 'row', gap: 11 },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    color: c.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  headings: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: {
    flexShrink: 1,
    color: c.ink,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  kinds: { color: c.muted, fontSize: 11, letterSpacing: -0.1 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  liveDotWrap: {
    width: 7,
    height: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveHalo: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#14A571',
  },
  status: { fontSize: 10.5, fontWeight: '600', letterSpacing: -0.1 },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#FFF6E5',
  },
  ratingValue: { color: '#7A5205', fontSize: 11, fontWeight: '700' },
  ratingCount: { color: '#B08A44', fontSize: 10 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { color: c.muted, fontSize: 11, fontWeight: '500' },
  divider: { width: 1, height: 11, backgroundColor: '#E4EBF1' },
  delivery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
  },
  deliveryText: { fontSize: 11, fontWeight: '600', letterSpacing: -0.1 },
});
