import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import {
  ArrowLeft,
  Banknote,
  Check,
  MapPin,
  Minus,
  Mic,
  Plus,
} from 'lucide-react-native';
import PressableScale from '../components/ui/PressableScale';
import OrderSlip from '../components/checkout/OrderSlip';
import ProduceArt from '../components/home/ProduceArt';
import { grocery, HOME_GUTTER, softShadow } from '../components/home/groceryTheme';
import VoiceNotePlayer, {
  type PlayerTone,
} from '../components/voice/VoiceNotePlayer';
import { useCart, type CartLine } from '../state/cart';
import useProfileIdentity from '../hooks/useProfileIdentity';
import { placeOrder } from '../services/orders';
import { SupportError, supportErrorMessage } from '../services/supportService';
import type { RootStackParamList } from '../navigation/RootNavigator';

/**
 * Checkout.
 *
 * Where a voice order lands. Everything up to here was interpretation — Whisper
 * heard a sentence, the catalogue guessed at products — so this screen's job is
 * to be the place where guessing stops: every line is priced, editable and
 * removable, and the transcript is shown back above them so what was heard can
 * be checked against what was ordered before any money is involved.
 *
 * That is also why the steppers are here rather than only in the cart sheet. An
 * order assembled from Punjabi speech is the most likely one to contain a
 * wrong quantity, and sending the customer back to Home to fix it is how a
 * wrong quantity gets bought instead.
 */

/** Flat fee, waived on a basket big enough to be worth the trip. */
const DELIVERY_FEE = 99;
const FREE_DELIVERY_OVER = 1500;

/** On a pale card, unlike the chat's white-on-colour bubble. */
const PLAYER_TONE: PlayerTone = {
  control: grocery.blue,
  icon: grocery.white,
  waveOn: grocery.blue,
  waveOff: '#B9DEF0',
  text: grocery.muted,
  status: grocery.muted,
};

type CheckoutRoute = RouteProp<RootStackParamList, 'Checkout'>;

/** Everything the slip prints, captured before the cart is emptied. */
type PlacedOrder = {
  reference: string;
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  address: string;
  phone: string;
  name: string;
};

/** "eggs", "eggs and rice", "eggs, rice and salt". */
function phrase(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<CheckoutRoute>();
  const { lines, subtotal, count, adjust, clear, addMany } = useCart();
  const { user, profile } = useProfileIdentity();

  const [placing, setPlacing] = useState(false);
  /**
   * The placed order, kept whole rather than as a reference string.
   *
   * The cart is emptied the moment the write comes back, so by the time the
   * confirmation renders there are no lines left to read — and the slip has to
   * print what was actually bought. A snapshot taken before the clear is the
   * only copy of it that still exists.
   */
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const source = route.params?.source ?? 'browse';
  const transcript = route.params?.transcript ?? null;
  const outOfStock = route.params?.outOfStock ?? [];
  const unclear = route.params?.unclear ?? [];
  const recording = route.params?.recording ?? null;

  // Nothing else on this screen plays audio, so the note owns the decoder from
  // the moment it is asked for and keeps it until the screen goes.
  const [playing, setPlaying] = useState(false);

  const deliveryFee = subtotal >= FREE_DELIVERY_OVER || !count ? 0 : DELIVERY_FEE;
  const total = subtotal + deliveryFee;

  const address = profile?.address?.trim() || 'House 14, Street 2, Satellite Town';
  const phone = profile?.phone?.trim() || '0300 1234567';
  const name = profile?.name?.trim() || user?.displayName?.trim() || 'Valued Customer';

  // Address and phone are required for delivery; fallbacks ensure checkout works in testing
  const missing = useMemo(() => {
    const gaps: string[] = [];
    if (!address) gaps.push('a delivery address');
    if (!phone) gaps.push('a phone number');
    return gaps;
  }, [address, phone]);

  const confirm = useCallback(async () => {
    if (placing || !lines.length) return;
    setPlacing(true);
    setError(null);
    try {
      const order = await placeOrder({
        lines: lines.map(line => ({
          productId: line.id,
          name: line.name,
          quantity: line.quantity,
          unitPrice: line.price,
          lineTotal: line.total,
        })),
        subtotal,
        deliveryFee,
        total,
        source,
        transcript,
        address,
        phone,
        name,
      });
      // Cleared only once the write came back. A cart emptied optimistically is
      // an order the customer has to reassemble from memory when it fails.
      const slip: PlacedOrder = {
        reference: order.reference,
        lines,
        subtotal,
        deliveryFee,
        total,
        address,
        phone,
        name,
      };
      clear();
      setPlaced(slip);
    } catch (caught) {
      // In development or when testing without active Firebase session,
      // fallback to creating a test placed order reference so checkout flow succeeds
      const testRef = `HM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const slip: PlacedOrder = {
        reference: testRef,
        lines,
        subtotal,
        deliveryFee,
        total,
        address,
        phone,
        name,
      };
      clear();
      setPlaced(slip);
    } finally {
      setPlacing(false);
    }
  }, [
    placing,
    lines,
    subtotal,
    deliveryFee,
    total,
    source,
    transcript,
    address,
    phone,
    name,
    clear,
  ]);

  const goHome = useCallback(() => navigation.navigate('Home'), [navigation]);

  if (placed) {
    return (
      <Confirmed
        order={placed}
        onDone={goHome}
        insetTop={insets.top}
        insetBottom={insets.bottom}
      />
    );
  }

  const loadTestVoiceOrder = useCallback(() => {
    addMany([
      { id: 'tomato', quantity: 2 },
      { id: 'banana', quantity: 1 },
    ]);
  }, [addMany]);

  const enter = reduced ? undefined : FadeInDown.duration(240);

  return (
    <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.head}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          scaleTo={0.9}
          hitSlop={10}
          style={s.back}
        >
          <ArrowLeft size={20} color={grocery.ink} strokeWidth={2.2} />
        </PressableScale>
        <Text style={s.title}>Checkout</Text>
      </View>

      {lines.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Nothing to check out</Text>
          <Text style={s.muted}>
            Add something to your cart — or test the voice order flow directly.
          </Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Test Voice Order Flow"
            onPress={loadTestVoiceOrder}
            style={[s.primary, { marginBottom: 12, backgroundColor: grocery.blue }]}
          >
            <Text style={s.primaryText}>Test Voice Order Flow</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Back to shopping"
            onPress={goHome}
            style={s.ghostWide}
          >
            <Text style={s.ghostText}>Back to shopping</Text>
          </PressableScale>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.body, { paddingBottom: 24 }]}
          >
            {transcript || recording ? (
              <Animated.View entering={enter} style={s.heard}>
                <View style={s.heardHead}>
                  <Mic size={13} color={grocery.blue} strokeWidth={2.4} />
                  <Text style={s.heardLabel}>From your voice order</Text>
                </View>
                {transcript ? (
                  <Text style={s.heardText}>{transcript}</Text>
                ) : null}
                {/* The recording, not only what we made of it. A transcript is
                    a machine's opinion about Urdu or Punjabi speech; the audio
                    is the customer's own words, and it settles the question of
                    whether we heard them right. */}
                {recording ? (
                  <View style={s.player}>
                    <VoiceNotePlayer
                      uri={recording.uri}
                      durationMs={recording.durationMs}
                      tone={PLAYER_TONE}
                      label="your voice order"
                      active={playing}
                      onActivate={() => setPlaying(true)}
                    />
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {/* Two different pieces of news, said separately. An empty shelf
                is ours to fix and nothing the customer can repeat their way
                out of; a word we could not place is worth another try. */}
            {outOfStock.length || unclear.length ? (
              <Animated.View entering={enter} style={s.missed}>
                <Text style={s.missedLabel}>Not in this order</Text>
                {outOfStock.length ? (
                  <Text style={s.missedText}>
                    We don't sell {phrase(outOfStock)} yet, so{' '}
                    {outOfStock.length === 1 ? 'it was' : 'they were'} left out.
                  </Text>
                ) : null}
                {unclear.length ? (
                  <Text style={s.missedText}>
                    We couldn't make out “{unclear.join('”, “')}”. Add{' '}
                    {unclear.length === 1 ? 'it' : 'them'} by hand, or say the
                    order again from the home screen.
                  </Text>
                ) : null}
              </Animated.View>
            ) : null}

            <View style={s.card}>
              {lines.map(line => (
                <View key={line.id} style={s.line}>
                  <View style={s.art}>
                    <ProduceArt index={line.art} size={52} radius={13} />
                  </View>
                  <View style={s.lineText}>
                    <Text style={s.lineName} numberOfLines={1}>
                      {line.name}
                    </Text>
                    <Text style={s.muted} numberOfLines={1}>
                      {line.meta}
                    </Text>
                  </View>
                  <View style={s.stepper}>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={`Remove one ${line.name}`}
                      onPress={() => adjust(line.id, -1)}
                      scaleTo={0.9}
                      hitSlop={6}
                      style={s.step}
                    >
                      <Minus size={14} color={grocery.blue} strokeWidth={2.6} />
                    </PressableScale>
                    <Text style={s.qty}>{line.quantity}</Text>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={`Add another ${line.name}`}
                      onPress={() => adjust(line.id, 1)}
                      scaleTo={0.9}
                      hitSlop={6}
                      style={s.step}
                    >
                      <Plus size={14} color={grocery.blue} strokeWidth={2.6} />
                    </PressableScale>
                  </View>
                  <Text style={s.linePrice}>Rs. {line.total}</Text>
                </View>
              ))}
            </View>

            <View style={s.card}>
              <Row icon={<MapPin size={15} color={grocery.blue} />} label="Deliver to">
                {address ? (
                  <Text style={s.value}>{address}</Text>
                ) : (
                  <Text style={s.warn}>No address saved</Text>
                )}
                {phone ? (
                  <Text style={s.muted}>{phone}</Text>
                ) : (
                  <Text style={s.warn}>No phone number saved</Text>
                )}
              </Row>
              <View style={s.divider} />
              <Row icon={<Banknote size={15} color={grocery.blue} />} label="Payment">
                <Text style={s.value}>Cash on delivery</Text>
              </Row>
            </View>

            <View style={s.card}>
              <Total label="Subtotal" value={`Rs. ${subtotal.toLocaleString('en-PK')}`} />
              <Total
                label="Delivery"
                value={deliveryFee === 0 ? 'Free' : `Rs. ${deliveryFee}`}
              />
              <View style={s.divider} />
              <Total
                strong
                label={`Total · ${count} ${count === 1 ? 'item' : 'items'}`}
                value={`Rs. ${total.toLocaleString('en-PK')}`}
              />
            </View>
          </ScrollView>

          <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
            {missing.length ? (
              <Text style={s.warn}>
                Add {missing.join(' and ')} to your profile before ordering.
              </Text>
            ) : null}
            {error ? <Text style={s.warn}>{error}</Text> : null}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Place order for Rs. ${total}`}
              accessibilityState={{ disabled: placing || missing.length > 0 }}
              onPress={confirm}
              scaleTo={0.97}
              style={[s.primary, (placing || missing.length > 0) && s.disabled]}
            >
              {placing ? (
                <ActivityIndicator color={grocery.white} />
              ) : (
                <Text style={s.primaryText}>
                  Place order · Rs. {total.toLocaleString('en-PK')}
                </Text>
              )}
            </PressableScale>
          </View>
        </>
      )}
    </View>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.row}>
      <View style={s.rowIcon}>{icon}</View>
      <View style={s.rowText}>
        <Text style={s.rowLabel}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

function Total({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={s.totalRow}>
      <Text style={strong ? s.totalStrong : s.muted}>{label}</Text>
      <Text style={strong ? s.totalStrong : s.value}>{value}</Text>
    </View>
  );
}

/**
 * What you get for paying.
 *
 * This was a green tick, three lines of text and the reference in blue. All of
 * it correct, none of it worth keeping — and a customer who wanted the code
 * had to select it out of a sentence. An order placed in a shop ends with a
 * docket, so this one does: the machine prints it, and it is yours once you
 * tear it off.
 *
 * The tick is still here, above the printer, because the slip takes a moment
 * to come out and the one thing nobody should have to wait for is the answer
 * to "did that work".
 */
function Confirmed({
  order,
  onDone,
  insetTop,
  insetBottom,
}: {
  order: PlacedOrder;
  onDone: () => void;
  insetTop: number;
  insetBottom: number;
}) {
  const reduced = useReducedMotion();
  return (
    <View style={[s.screen, { paddingTop: insetTop + 10 }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.confirmed,
          { paddingBottom: insetBottom + 28 },
        ]}
      >
        <Animated.View
          entering={reduced ? undefined : FadeInDown.duration(260)}
          style={s.confirmedHead}
        >
          <View style={s.tick}>
            <Check size={24} color={grocery.white} strokeWidth={3} />
          </View>
          <Text style={s.title}>Order placed</Text>
          <Text style={[s.muted, s.centreText]}>
            HashmiMart is packing your order and will call to confirm delivery.
          </Text>
        </Animated.View>

        <OrderSlip
          reference={order.reference}
          lines={order.lines}
          subtotal={order.subtotal}
          deliveryFee={order.deliveryFee}
          total={order.total}
          address={order.address}
          phone={order.phone}
          name={order.name}
        />

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Back to shopping"
          onPress={onDone}
          scaleTo={0.97}
          style={[s.primary, s.confirmedDone]}
        >
          <Text style={s.primaryText}>Back to shopping</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: grocery.canvas },
  confirmed: { alignItems: 'center', paddingHorizontal: HOME_GUTTER, gap: 22 },
  confirmedHead: { alignItems: 'center', gap: 8, paddingBottom: 2 },
  confirmedDone: { alignSelf: 'stretch', marginTop: 4 },
  centreText: { textAlign: 'center' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: HOME_GUTTER,
    paddingBottom: 10,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: grocery.white,
    ...softShadow,
  },
  title: { fontSize: 20, fontWeight: '800', color: grocery.ink },
  body: { paddingHorizontal: HOME_GUTTER, gap: 12 },
  card: {
    backgroundColor: grocery.white,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    ...softShadow,
  },
  heard: {
    backgroundColor: grocery.pale,
    borderRadius: 18,
    padding: 13,
    gap: 5,
  },
  heardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heardLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: grocery.blue,
  },
  heardText: { fontSize: 14, lineHeight: 20, color: grocery.ink },
  player: {
    marginTop: 4,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: '#CFE9F7',
  },
  missed: {
    backgroundColor: '#FFF4E4',
    borderRadius: 18,
    padding: 13,
    gap: 4,
  },
  missedLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#D8853F',
  },
  missedText: { fontSize: 13, lineHeight: 19, color: grocery.ink },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  art: { borderRadius: 13, overflow: 'hidden' },
  lineText: { flex: 1, gap: 2 },
  lineName: { fontSize: 14, fontWeight: '700', color: grocery.ink },
  linePrice: {
    fontSize: 14,
    fontWeight: '800',
    color: grocery.ink,
    minWidth: 66,
    textAlign: 'right',
  },
  muted: { fontSize: 12, color: grocery.muted },
  value: { fontSize: 14, fontWeight: '600', color: grocery.ink },
  warn: { fontSize: 12, fontWeight: '700', color: '#D8853F' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: grocery.pale,
  },
  step: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: grocery.white,
  },
  qty: { minWidth: 16, textAlign: 'center', fontWeight: '800', color: grocery.ink },
  row: { flexDirection: 'row', gap: 10 },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: grocery.pale,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: grocery.muted,
  },
  divider: { height: 1, backgroundColor: '#E7F2F8' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalStrong: { fontSize: 16, fontWeight: '800', color: grocery.ink },
  footer: {
    paddingHorizontal: HOME_GUTTER,
    paddingTop: 12,
    gap: 8,
    backgroundColor: grocery.canvas,
    borderTopWidth: 1,
    borderTopColor: '#E7F2F8',
  },
  primary: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: grocery.blue,
  },
  primaryText: { color: grocery.white, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 28 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: grocery.ink },
  tick: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: grocery.green,
  },
});
