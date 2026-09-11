import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Banknote, Check, Mic, Pencil, TriangleAlert } from 'lucide-react-native';
import PressableScale from '../ui/PressableScale';
import ProduceArt from '../home/ProduceArt';
import { grocery } from '../home/groceryTheme';
import OrderSummary from './OrderSummary';
import { money, type OrderTotals } from '../../services/pricing';
import type { CartLine } from '../../state/cart';
import type { DeliveryForm } from '../../validation/delivery';

/**
 * Step two: nothing to change, one thing to decide.
 *
 * Read-only on purpose. Every control removed from this screen is a control
 * that cannot be hit by accident next to the button that charges the customer,
 * and the absence of them is what makes it read as a confirmation rather than
 * as the form again. The way back is a labelled Edit, which is a decision, not
 * a slip.
 *
 * The order is not written until Place order is pressed. Getting here commits
 * nothing — which is why this screen can be reached and left as often as the
 * customer likes without leaving half-orders in Firestore.
 */

type Props = {
  form: DeliveryForm;
  lines: CartLine[];
  totals: OrderTotals;
  fromVoice: boolean;
  onEdit: () => void;
  onPlace: () => void;
  placing: boolean;
  error: string | null;
  bottomInset: number;
};

export default function PreviewStep({
  form,
  lines,
  totals,
  fromVoice,
  onEdit,
  onPlace,
  placing,
  error,
  bottomInset,
}: Props) {
  const reduced = useReducedMotion();
  const enter = reduced ? undefined : FadeInDown.duration(240);

  return (
    <View style={s.fill}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.body}
      >
        <Animated.View entering={enter} style={s.intro}>
          <Text style={s.title}>Review your order</Text>
          <Text style={s.subtitle}>
            Make sure everything looks right before placing it.
          </Text>
        </Animated.View>

        {fromVoice ? (
          <View style={s.voice}>
            <Mic size={11} color={grocery.blue} strokeWidth={2.8} />
            <Text style={s.voiceText}>Voice order</Text>
          </View>
        ) : null}

        <Card title="Deliver to" onEdit={onEdit} editLabel="Edit delivery details">
          <Text style={s.name}>{form.name}</Text>
          <Text style={s.line}>+92 {form.phone}</Text>
          <View style={s.gap} />
          <Text style={s.line}>{form.area}</Text>
          <Text style={s.line}>{form.address}</Text>
          {form.instructions.trim() ? (
            <>
              <View style={s.gap} />
              <Text style={s.instructionsLabel}>Instructions</Text>
              <Text style={s.line}>{form.instructions.trim()}</Text>
            </>
          ) : null}
        </Card>

        <Card
          title="Items"
          count={`${totals.count} ${totals.count === 1 ? 'item' : 'items'}`}
          onEdit={onEdit}
          editLabel="Edit items"
        >
          {lines.map((line, index) => (
            <View key={line.id}>
              {index > 0 ? <View style={s.divider} /> : null}
              <View style={s.item}>
                <ProduceArt index={line.art} size={44} radius={12} />
                <View style={s.itemText}>
                  <Text style={s.itemName} numberOfLines={1}>
                    {line.name}
                  </Text>
                  <Text style={s.itemQty}>Qty {line.quantity}</Text>
                </View>
                <Text style={s.itemTotal}>{money(line.total)}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Card title="Payment">
          <View style={s.pay}>
            <View style={s.payMark}>
              <Banknote size={16} color={grocery.blue} strokeWidth={2.3} />
            </View>
            <Text style={s.payText}>Cash on delivery</Text>
            <View style={s.payTick}>
              <Check size={12} color={grocery.white} strokeWidth={3.4} />
            </View>
          </View>
        </Card>

        <OrderSummary totals={totals} strong />
      </ScrollView>

      <View style={[s.footer, { paddingBottom: bottomInset + 14 }]}>
        {error ? (
          <View style={s.error}>
            <TriangleAlert size={14} color="#D8543F" strokeWidth={2.4} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Place order for ${money(totals.total)}`}
          accessibilityState={{ disabled: placing }}
          onPress={onPlace}
          scaleTo={0.97}
          style={[s.cta, placing && s.ctaBusy]}
        >
          {placing ? (
            <ActivityIndicator color={grocery.white} />
          ) : (
            <Text style={s.ctaText}>
              Place order · {money(totals.total)}
            </Text>
          )}
        </PressableScale>
      </View>
    </View>
  );
}

function Card({
  title,
  count,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  count?: string;
  onEdit?: () => void;
  editLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>{title}</Text>
        {count ? <Text style={s.cardCount}>{count}</Text> : null}
        {onEdit ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={editLabel ?? `Edit ${title}`}
            onPress={onEdit}
            scaleTo={0.93}
            hitSlop={8}
            style={s.edit}
          >
            <Pencil size={12} color={grocery.blue} strokeWidth={2.5} />
            <Text style={s.editText}>Edit</Text>
          </PressableScale>
        ) : null}
      </View>
      <View style={s.cardBody}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 24, gap: 14 },
  intro: { gap: 5, paddingBottom: 2 },
  title: { fontSize: 21, fontWeight: '900', color: grocery.ink },
  subtitle: { fontSize: 13.5, lineHeight: 19, color: grocery.muted },

  voice: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: grocery.pale,
  },
  voiceText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: grocery.blue,
  },

  card: {
    backgroundColor: grocery.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3EEF4',
    padding: 14,
    gap: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: grocery.muted,
  },
  cardCount: { fontSize: 11.5, fontWeight: '700', color: '#9BB0BE' },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText: { fontSize: 12.5, fontWeight: '800', color: grocery.blue },
  cardBody: { gap: 2 },

  name: { fontSize: 15, fontWeight: '800', color: grocery.ink },
  line: { fontSize: 13.5, lineHeight: 19, color: '#5A6E7C' },
  gap: { height: 8 },
  instructionsLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#9BB0BE',
  },

  divider: { height: 1, backgroundColor: '#EEF5F9', marginVertical: 9 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  itemText: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: '700', color: grocery.ink },
  itemQty: { fontSize: 11.5, fontWeight: '700', color: grocery.muted },
  itemTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: grocery.ink,
    fontVariant: ['tabular-nums'],
  },

  pay: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: grocery.pale,
  },
  payText: { flex: 1, fontSize: 14.5, fontWeight: '700', color: grocery.ink },
  payTick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: grocery.blue,
  },

  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 9,
    backgroundColor: grocery.canvas,
    borderTopWidth: 1,
    borderTopColor: '#E3EEF4',
  },
  error: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  errorText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: '#D8543F' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 27,
    backgroundColor: grocery.blue,
  },
  ctaBusy: { opacity: 0.7 },
  ctaText: { fontSize: 15.5, fontWeight: '900', color: grocery.white },
});
