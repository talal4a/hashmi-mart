import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';
import PressableScale from '../components/ui/PressableScale';
import CheckoutStepper from '../components/checkout/CheckoutStepper';
import DetailsStep from '../components/checkout/DetailsStep';
import PreviewStep from '../components/checkout/PreviewStep';
import ReceiptStep from '../components/checkout/ReceiptStep';
import { grocery, HOME_GUTTER } from '../components/home/groceryTheme';
import { useCart } from '../state/cart';
import useProfileIdentity from '../hooks/useProfileIdentity';
import { placeOrder } from '../services/orders';
import { priceOrder } from '../services/pricing';
import type { Receipt } from '../services/receipt';
import { SupportError, supportErrorMessage } from '../services/supportService';
import { DELIVERY_AREAS } from '../data/deliveryAreas';
import { fromE164, groupDigits, toE164 } from '../utils/phone';
import {
  validateDelivery,
  type DeliveryErrors,
  type DeliveryForm,
} from '../validation/delivery';
import type { RootStackParamList } from '../navigation/RootNavigator';

/**
 * Checkout, as three named stages.
 *
 * It used to be one screen that silently became a different screen once the
 * order went through, and nothing anywhere said how far along you were. You
 * could not tell that paying was two taps away rather than one, the delivery
 * details were printed as text you had to leave the screen to change, and
 * afterwards there was no sign that the receipt was the end of it.
 *
 * So: Details is everything you can still change, Preview is the same order
 * with nothing editable and one decision on it, Receipt is the record. The
 * stepper sits above all three and never scrolls away, which is the only part
 * of this that has to be true on every frame — a customer who has scrolled into
 * a form should still know which of the three they are in.
 *
 * The split is also what makes the write safe. Nothing reaches Firestore until
 * Place order on step two, so stepping back and forth costs nothing, and the
 * receipt cannot be reached by a timer — only by an order that actually exists.
 */

type Stage = 'details' | 'preview' | 'receipt';
const STAGE_INDEX: Record<Stage, number> = { details: 0, preview: 1, receipt: 2 };

type CheckoutRoute = RouteProp<RootStackParamList, 'Checkout'>;

const EMPTY_FORM: DeliveryForm = {
  name: '',
  phone: '',
  area: '',
  address: '',
  instructions: '',
};

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<CheckoutRoute>();
  const { lines, adjust, clear } = useCart();
  const { user, profile } = useProfileIdentity();

  const [stage, setStage] = useState<Stage>('details');
  const [form, setForm] = useState<DeliveryForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<DeliveryErrors>({});
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * The order as placed, kept whole.
   *
   * The cart is emptied the moment the write comes back, so by the time the
   * receipt renders there are no lines left to read — and it has to print what
   * was actually bought. A snapshot taken before the clear is the only copy of
   * it that still exists.
   */
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const source = route.params?.source ?? 'browse';
  const transcript = route.params?.transcript ?? null;
  const outOfStock = route.params?.outOfStock ?? [];
  const unclear = route.params?.unclear ?? [];
  const recording = route.params?.recording ?? null;
  const fromVoice = source === 'voice';

  // Nothing else on this screen plays audio, so the note owns the decoder from
  // the moment it is asked for and keeps it until the screen goes.
  const [playing, setPlaying] = useState(false);

  const totals = useMemo(() => priceOrder(lines), [lines]);

  /**
   * Fills the form from the account, without ever overwriting a typed value.
   *
   * Tracked per field rather than with a single "have we seeded yet" flag,
   * which is what this was and which was wrong in the ordinary case: the auth
   * user resolves first and the Firestore profile a moment later, so a flag set
   * on the first arrival meant the form filled in a display name and then
   * stopped — phone and address left blank on an account that had both, and no
   * way to tell from looking at it that anything had failed.
   *
   * Touching a field opts it out for good, so a profile that re-reads while
   * someone is halfway through correcting their address cannot put the old one
   * back under the cursor.
   */
  const touched = useRef(new Set<keyof DeliveryForm>());
  useEffect(() => {
    if (!profile && !user) return;
    setForm(current => {
      const next = { ...current };
      const fill = (key: keyof DeliveryForm, value: string) => {
        if (value && !touched.current.has(key) && !current[key]) next[key] = value;
      };
      fill('name', profile?.name?.trim() || user?.displayName?.trim() || '');
      fill('phone', groupDigits(fromE164(profile?.phone ?? null)));
      // The stored address is one line of free text written before areas
      // existed, so it seeds the address and the area is chosen — guessing a
      // zone out of prose is how an order goes to the wrong side of the city.
      fill('address', profile?.address?.trim() || '');
      fill(
        'area',
        DELIVERY_AREAS.find(candidate =>
          (profile?.address ?? '').toLowerCase().includes(candidate.toLowerCase()),
        ) ?? '',
      );
      return next;
    });
  }, [profile, user]);

  const change = useCallback(
    <K extends keyof DeliveryForm>(key: K, value: DeliveryForm[K]) => {
      // Opted out of seeding for good: a profile arriving late must not land
      // on top of what the customer is typing.
      touched.current.add(key);
      setForm(current => ({ ...current, [key]: value }));
      // Cleared as soon as the field is touched. An error that stays under a
      // field the customer is currently fixing is an error about the past.
      setErrors(current =>
        current[key] ? { ...current, [key]: undefined } : current,
      );
    },
    [],
  );

  const remove = useCallback(
    (id: string) => {
      const line = lines.find(candidate => candidate.id === id);
      if (line) adjust(id, -line.quantity);
    },
    [lines, adjust],
  );

  const toPreview = useCallback(() => {
    const found = validateDelivery(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (!lines.length) return;
    setError(null);
    setStage('preview');
  }, [form, lines.length]);

  const confirm = useCallback(async () => {
    if (placing || !lines.length) return;
    setPlacing(true);
    setError(null);
    try {
      const placedAt = new Date();
      const order = await placeOrder({
        lines: lines.map(line => ({
          productId: line.id,
          name: line.name,
          quantity: line.quantity,
          unitPrice: line.price,
          lineTotal: line.total,
        })),
        subtotal: totals.goods,
        listSubtotal: totals.subtotal,
        discount: totals.discount,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
        source,
        transcript,
        name: form.name.trim(),
        phone: toE164(form.phone) ?? form.phone.trim(),
        area: form.area,
        address: form.address.trim(),
        instructions: form.instructions.trim() || null,
      });

      const slip: Receipt = {
        reference: order.reference,
        lines,
        subtotal: totals.subtotal,
        discount: totals.discount,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
        name: form.name.trim(),
        phone: form.phone.trim(),
        area: form.area,
        address: form.address.trim(),
        placedAt,
      };

      // Cleared only once the write came back. A cart emptied optimistically is
      // an order the customer has to reassemble from memory when it fails.
      clear();
      setReceipt(slip);
      setStage('receipt');
    } catch (caught) {
      setError(
        supportErrorMessage(
          caught instanceof SupportError ? caught.kind : 'unavailable',
        ),
      );
    } finally {
      setPlacing(false);
    }
  }, [placing, lines, totals, source, transcript, form, clear]);

  const goHome = useCallback(() => navigation.navigate('Home'), [navigation]);

  const back = useCallback(() => {
    if (stage === 'preview') {
      setStage('details');
      return;
    }
    navigation.goBack();
  }, [stage, navigation]);

  const empty = lines.length === 0 && stage !== 'receipt';

  return (
    <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header and stepper are the fixed part of the screen. Everything below
          scrolls under them, so the answer to "where am I" is never more than
          a glance away regardless of how far into a form someone has got. */}
      <View style={s.top}>
        <View style={s.head}>
          {stage === 'receipt' ? (
            <View style={s.backSpacer} />
          ) : (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={stage === 'preview' ? 'Back to details' : 'Back'}
              onPress={back}
              scaleTo={0.9}
              hitSlop={10}
              style={s.back}
            >
              <ArrowLeft size={19} color={grocery.ink} strokeWidth={2.3} />
            </PressableScale>
          )}
          <Text style={s.title}>{fromVoice ? 'Voice order' : 'Checkout'}</Text>
          <View style={s.backSpacer} />
        </View>
        <View style={s.stepper}>
          <CheckoutStepper at={STAGE_INDEX[stage]} />
        </View>
      </View>

      {empty ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Nothing to check out</Text>
          <Text style={s.emptyText}>
            Add something to your cart — or say what you need and we will fill
            it in for you.
          </Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Back to shopping"
            onPress={goHome}
            scaleTo={0.97}
            style={s.emptyCta}
          >
            <Text style={s.emptyCtaText}>Back to shopping</Text>
          </PressableScale>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={s.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 96}
        >
          <Animated.View
            // Keyed by stage so each one fades in as its own thing rather than
            // the old content morphing into the new.
            key={stage}
            entering={reduced ? undefined : FadeIn.duration(200)}
            style={s.fill}
          >
            {stage === 'details' ? (
              <DetailsStep
                form={form}
                errors={errors}
                onChange={change}
                lines={lines}
                totals={totals}
                onAdjust={adjust}
                onRemove={remove}
                fromVoice={fromVoice}
                recording={recording}
                playing={playing}
                onPlay={() => setPlaying(true)}
                outOfStock={outOfStock}
                unclear={unclear}
                onContinue={toPreview}
                bottomInset={insets.bottom}
              />
            ) : stage === 'preview' ? (
              <PreviewStep
                form={form}
                lines={lines}
                totals={totals}
                fromVoice={fromVoice}
                onEdit={() => setStage('details')}
                onPlace={confirm}
                placing={placing}
                error={error}
                bottomInset={insets.bottom}
              />
            ) : receipt ? (
              <ReceiptStep
                receipt={receipt}
                onDone={goHome}
                bottomInset={insets.bottom}
              />
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: grocery.canvas },
  fill: { flex: 1 },

  top: {
    paddingHorizontal: HOME_GUTTER,
    paddingBottom: 14,
    backgroundColor: grocery.canvas,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: grocery.white,
    borderWidth: 1,
    borderColor: '#E3EEF4',
  },
  // Keeps the title optically centred whether or not there is a back button.
  backSpacer: { width: 38, height: 38 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '900', color: grocery.ink },
  stepper: { paddingTop: 16, paddingHorizontal: 4 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 28,
  },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: grocery.ink },
  emptyText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: grocery.muted,
    textAlign: 'center',
  },
  emptyCta: {
    height: 52,
    paddingHorizontal: 26,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    backgroundColor: grocery.blue,
  },
  emptyCtaText: { fontSize: 15, fontWeight: '900', color: grocery.white },
});
