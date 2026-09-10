import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, Check, CircleHelp, Clock3, MapPin, Package, RefreshCw, ShoppingBag, Truck, X } from 'lucide-react-native';
import PressableScale from '../components/ui/PressableScale';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { watchOrder, type PlacedOrder } from '../services/orders';

const C = {
  canvas: '#F2FAFD', paper: '#FFFFFF', ink: '#0B2936', muted: '#688493',
  cyan: '#08ACE0', cyanDark: '#007CA3', pale: '#E5F6FC', line: '#DEECF2',
  green: '#247447', mint: '#E8F8EE', amber: '#946022', amberPale: '#FFF5E5',
};

const STAGES = [
  { status: 'placed', label: 'Order received', description: 'Your order is with HashmiMart. We’ll update this page as it moves along.', Icon: ShoppingBag },
  { status: 'preparing', label: 'Preparing', description: 'The store is getting your groceries ready.', Icon: ShoppingBag },
  { status: 'packed', label: 'Packed', description: 'Your groceries are packed and ready for delivery.', Icon: Package },
  { status: 'out_for_delivery', label: 'Out for delivery', description: 'Your order is on its way to your delivery address.', Icon: Truck },
  { status: 'delivered', label: 'Delivered', description: 'Your order has been marked as delivered. Thank you for shopping with HashmiMart.', Icon: Check },
];
const CANCELLED = { label: 'Cancelled', description: 'This order has been cancelled. Contact support if you need help with it.', Icon: X };
const UNKNOWN = { label: 'Status update pending', description: 'A delivery update isn’t available yet. Check back soon.', Icon: CircleHelp };
const money = (value: number) => `Rs. ${value.toLocaleString('en-PK')}`;
type TrackingState = { phase: 'loading' | 'error' } | { phase: 'ready'; order: PlacedOrder };

export default function OrderTrackingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'OrderTracking'>>();
  const { orderId, reference } = route.params;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<TrackingState>({ phase: 'loading' });

  useFocusEffect(useCallback(() => {
    let active = true;
    let stop: (() => void) | undefined;
    setState({ phase: 'loading' });
    try {
      stop = watchOrder(
        orderId,
        order => { if (active) setState({ phase: 'ready', order }); },
        () => { if (active) setState({ phase: 'error' }); },
      );
    } catch {
      setState({ phase: 'error' });
    }
    return () => {
      // Firestore can already have queued a callback when a screen blurs.
      active = false;
      stop?.();
    };
  }, [orderId, attempt]));

  const goHome = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }, [navigation]);
  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else goHome();
  }, [navigation, goHome]);
  const order = state.phase === 'ready' && state.order.id === orderId ? state.order : null;

  return (
    <View style={[s.screen, { paddingTop: insets.top + 6 }]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} scaleTo={0.92} style={s.back}>
          <ArrowLeft size={21} color={C.ink} strokeWidth={2.2} />
        </PressableScale>
        <Text style={s.navTitle}>Track order</Text>
        <View style={s.headerMark} accessible={false}>
          <ShoppingBag size={20} color={C.cyanDark} strokeWidth={1.8} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.body, { paddingBottom: 24 }]}>
        <View style={s.referenceBlock}>
          <Text style={s.eyebrow}>YOUR ORDER</Text>
          <Text selectable style={s.reference}>{order?.reference || reference}</Text>
          <Text style={s.bodyText}>Updates from the store, all in one place.</Text>
        </View>

        {state.phase === 'error' ? (
          <View style={s.messageCard} accessibilityLiveRegion="polite">
            <View style={[s.statusIcon, s.warningIcon]}>
              <RefreshCw size={28} color={C.amber} strokeWidth={1.6} />
            </View>
            <Text accessibilityRole="header" style={s.messageTitle}>We couldn't load this order.</Text>
            <Text style={[s.bodyText, s.centerText]}>Try again to get the latest update. Your order has not been changed.</Text>
            <PressableScale accessibilityRole="button" accessibilityLabel="Retry order updates" onPress={() => setAttempt(value => value + 1)} style={s.retry}>
              <RefreshCw size={17} color={C.cyanDark} />
              <Text style={s.retryText}>Try again</Text>
            </PressableScale>
          </View>
        ) : order ? (
          <>
            <OrderProgress status={order.status} />
            <OrderDetails order={order} />
          </>
        ) : (
          <View style={s.messageCard} accessibilityLiveRegion="polite">
            <View style={s.statusIcon}>
              <ActivityIndicator color={C.cyanDark} size="large" accessibilityLabel="Loading order updates" />
            </View>
            <Text style={s.messageTitle}>Getting your latest update</Text>
            <Text style={[s.bodyText, s.centerText]}>Your order details will appear here.</Text>
          </View>
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={goHome} style={s.homeButton}>
          <Text style={s.homeText}>Back to home</Text>
          <ArrowRight size={19} color={C.paper} />
        </PressableScale>
      </View>
    </View>
  );
}

function OrderProgress({ status }: { status: string }) {
  const current = STAGES.findIndex(stage => stage.status === status);
  const cancelled = status === 'cancelled';
  const delivered = status === 'delivered';
  const stage = current >= 0 ? STAGES[current] : cancelled ? CANCELLED : UNKNOWN;
  const { Icon } = stage;
  const accent = cancelled ? C.amber : delivered ? C.green : C.cyanDark;

  return (
    <View style={s.card}>
      <View style={s.statusHead}>
        <View style={[s.statusIcon, cancelled && s.warningIcon, delivered && s.deliveredIcon]} accessible={false}>
          <Icon size={31} color={accent} strokeWidth={1.7} />
        </View>
        <View style={s.statusCopy}>
          <Text style={s.smallLabel}>LATEST STATUS</Text>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" accessibilityLabel={`Current order status: ${stage.label}`} style={s.statusTitle}>
            {stage.label}
          </Text>
        </View>
      </View>
      <Text style={[s.bodyText, s.statusDescription]}>{stage.description}</Text>
      {current >= 0 ? (
        <View style={s.progress} accessibilityLabel="Order progress">
          {STAGES.map((step, index) => {
            const complete = index < current || delivered;
            const selected = index === current;
            return (
              <View key={step.status} style={s.progressRow} accessible accessibilityLabel={`${step.label}: ${complete ? 'complete' : selected ? 'current stage' : 'upcoming'}`}>
                <View style={s.rail}>
                  {index < STAGES.length - 1 ? <View style={[s.railLine, index < current && s.railComplete]} /> : null}
                  <View style={[s.dot, complete && s.dotComplete, selected && !complete && s.dotCurrent]}>
                    {complete ? <Check size={12} color={C.paper} strokeWidth={2.6} /> : selected ? <View style={s.innerDot} /> : null}
                  </View>
                </View>
                <Text style={[s.stepLabel, (selected || complete) && s.stepReached, selected && s.stepCurrent]}>{step.label}</Text>
                {selected ? <Text style={[s.currentTag, delivered && s.deliveredTag]}>{delivered ? 'Complete' : 'Now'}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}
      <View style={s.updateNote}>
        <Clock3 size={13} color={C.muted} strokeWidth={1.8} />
        <Text style={s.noteText}>Updates appear when the store changes your order.</Text>
      </View>
    </View>
  );
}

function OrderDetails({ order }: { order: PlacedOrder }) {
  const count = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <>
      <View style={s.card}>
        <View style={s.sectionHead}>
          <Text accessibilityRole="header" style={s.sectionTitle}>In your order</Text>
          <Text style={s.count}>{count} {count === 1 ? 'item' : 'items'}</Text>
        </View>
        <View style={s.items}>
          {order.lines.map((line, index) => (
            <View key={`${line.productId}-${index}`} style={s.itemRow}>
              <View style={s.flex}>
                <Text style={s.itemName}>{line.name}</Text>
                <Text style={s.itemQuantity}>{line.quantity} × {money(line.unitPrice)}</Text>
              </View>
              <Text style={s.itemPrice}>{money(line.lineTotal)}</Text>
            </View>
          ))}
        </View>
        <View style={s.totals}>
          <Amount label="Subtotal" value={money(order.subtotal)} />
          <Amount label="Delivery" value={order.deliveryFee === 0 ? 'Free' : money(order.deliveryFee)} />
          {order.discount > 0 ? <Amount label="Discount" value={`− ${money(order.discount)}`} /> : null}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Order total</Text>
            <Text style={s.totalAmount}>{money(order.total)}</Text>
          </View>
          <Text style={s.noteText}>Cash on delivery</Text>
        </View>
      </View>
      <View style={s.card}>
        <View style={s.destinationHead}>
          <View style={s.mapIcon}><MapPin size={21} color={C.cyanDark} strokeWidth={1.8} /></View>
          <Text accessibilityRole="header" style={s.sectionTitle}>Delivery details</Text>
        </View>
        <View style={s.destination}>
          <Text style={s.destinationName}>{order.name}</Text>
          <Text style={s.address}>{order.address}</Text>
          {order.area ? <Text style={s.address}>{order.area}</Text> : null}
          <Text selectable style={s.phone}>{order.phone}</Text>
        </View>
        {order.instructions ? (
          <View style={s.instructions}>
            <Text style={s.smallLabel}>YOUR INSTRUCTIONS</Text>
            <Text style={s.instructionText}>{order.instructions}</Text>
          </View>
        ) : null}
      </View>
    </>
  );
}

function Amount({ label, value }: { label: string; value: string }) {
  return <View style={s.amountRow}><Text style={s.bodyText}>{label}</Text><Text style={s.amount}>{value}</Text></View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.canvas },
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 46, height: 46, borderRadius: 17, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, justifyContent: 'center', alignItems: 'center' },
  navTitle: { flex: 1, color: C.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  headerMark: { width: 42, height: 42, borderRadius: 16, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center' },
  body: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, gap: 18 },
  referenceBlock: { paddingTop: 16, paddingBottom: 6, gap: 9 },
  eyebrow: { color: C.cyanDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  reference: { color: C.ink, fontSize: 30, fontWeight: '800', letterSpacing: 0.4, fontVariant: ['tabular-nums'] },
  bodyText: { color: C.muted, fontSize: 13, lineHeight: 20 },
  card: { backgroundColor: C.paper, borderRadius: 26, borderWidth: 1, borderColor: C.line, padding: 20 },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  statusIcon: { width: 64, height: 64, borderRadius: 23, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center' },
  warningIcon: { backgroundColor: C.amberPale },
  deliveredIcon: { backgroundColor: C.mint },
  statusCopy: { flex: 1, gap: 6 },
  smallLabel: { color: C.muted, fontSize: 9, lineHeight: 14, fontWeight: '700', letterSpacing: 1.2 },
  statusTitle: { color: C.ink, fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.8 },
  statusDescription: { marginTop: 16 },
  progress: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: C.line },
  progressRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rail: { width: 24, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  railLine: { width: 2, position: 'absolute', top: '50%', bottom: -21, backgroundColor: C.line },
  railComplete: { backgroundColor: '#A8DDEB' },
  dot: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.paper, justifyContent: 'center', alignItems: 'center' },
  dotComplete: { backgroundColor: C.cyanDark, borderColor: C.cyanDark },
  dotCurrent: { borderColor: C.cyan, backgroundColor: C.pale },
  innerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.cyan },
  stepLabel: { flex: 1, color: C.muted, fontSize: 13, lineHeight: 20 },
  stepReached: { color: C.ink },
  stepCurrent: { fontWeight: '800' },
  currentTag: { color: C.cyanDark, backgroundColor: C.pale, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, fontSize: 10, fontWeight: '700' },
  deliveredTag: { color: C.green, backgroundColor: C.mint },
  updateNote: { marginTop: 17, flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  noteText: { flexShrink: 1, color: C.muted, fontSize: 10, lineHeight: 15 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: C.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  count: { color: C.cyanDark, backgroundColor: C.pale, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, overflow: 'hidden', fontSize: 10, fontWeight: '700' },
  items: { paddingTop: 6 },
  itemRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  flex: { flex: 1 },
  itemName: { color: C.ink, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  itemQuantity: { color: C.muted, fontSize: 11, lineHeight: 18, marginTop: 3, fontVariant: ['tabular-nums'] },
  itemPrice: { color: C.ink, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  totals: { gap: 9, marginTop: 16 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  amount: { color: C.ink, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  totalRow: { borderTopWidth: 1, borderTopColor: C.line, marginTop: 4, paddingTop: 15, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  totalLabel: { color: C.ink, fontSize: 14, fontWeight: '800' },
  totalAmount: { color: C.ink, fontSize: 25, fontWeight: '800', letterSpacing: -0.9, fontVariant: ['tabular-nums'] },
  destinationHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  mapIcon: { width: 39, height: 39, borderRadius: 14, backgroundColor: C.pale, justifyContent: 'center', alignItems: 'center' },
  destination: { marginTop: 15, gap: 3 },
  destinationName: { color: C.ink, fontSize: 14, lineHeight: 22, fontWeight: '700', marginBottom: 3 },
  address: { color: C.ink, fontSize: 13, lineHeight: 20 },
  phone: { color: C.muted, fontSize: 12, lineHeight: 19, marginTop: 6 },
  instructions: { borderTopWidth: 1, borderTopColor: C.line, marginTop: 16, paddingTop: 14, gap: 6 },
  instructionText: { color: C.ink, fontSize: 13, lineHeight: 20, writingDirection: 'auto' },
  messageCard: { backgroundColor: C.paper, borderRadius: 26, borderWidth: 1, borderColor: C.line, paddingHorizontal: 23, paddingVertical: 32, gap: 15, alignItems: 'center' },
  messageTitle: { color: C.ink, fontSize: 21, lineHeight: 28, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' },
  centerText: { textAlign: 'center' },
  retry: { minHeight: 48, borderRadius: 16, backgroundColor: C.pale, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 3 },
  retryText: { color: C.cyanDark, fontSize: 13, fontWeight: '800' },
  footer: { backgroundColor: C.paper, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 20, paddingTop: 14 },
  homeButton: { width: '100%', maxWidth: 580, alignSelf: 'center', minHeight: 54, backgroundColor: C.cyan, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, paddingHorizontal: 18 },
  homeText: { color: C.paper, fontSize: 14, fontWeight: '800' },
});
