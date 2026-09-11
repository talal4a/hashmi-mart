import { StyleSheet, Text, View } from 'react-native';
import { grocery } from '../home/groceryTheme';
import { money, type OrderTotals } from '../../services/pricing';

/**
 * The money, in the one arrangement it is ever shown in.
 *
 * Shared between Details and Preview rather than written twice, because the
 * failure mode of two copies is a total that differs between the screen you
 * agreed on and the screen you paid on — and nothing about that looks like a
 * bug until a customer reads both.
 *
 * `strong` is the only difference between the two: on Preview the total is the
 * thing being agreed to, so it carries weight; on Details it is still an
 * estimate under a form that is being edited.
 */
export default function OrderSummary({
  totals,
  strong = false,
}: {
  totals: OrderTotals;
  strong?: boolean;
}) {
  return (
    <View style={s.card}>
      <Row label="Subtotal" value={money(totals.subtotal)} />
      {totals.discount > 0 ? (
        <Row label="Discount" value={`− ${money(totals.discount)}`} good />
      ) : null}
      <Row
        label="Delivery"
        value={totals.deliveryFee === 0 ? 'Free' : money(totals.deliveryFee)}
        good={totals.deliveryFee === 0}
      />

      <View style={s.rule} />

      <View style={s.totalRow}>
        <Text style={strong ? s.totalLabelStrong : s.totalLabel}>
          {strong ? 'Total' : 'Estimated total'}
        </Text>
        <Text style={strong ? s.totalValueStrong : s.totalValue}>
          {money(totals.total)}
        </Text>
      </View>

      {/* Only while it is still worth acting on. Telling someone who already
          has free delivery how to get free delivery is noise. */}
      {totals.toFreeDelivery > 0 && totals.count > 0 ? (
        <Text style={s.nudge}>
          {money(totals.toFreeDelivery)} more for free delivery
        </Text>
      ) : null}
    </View>
  );
}

function Row({
  label,
  value,
  good = false,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.value, good && s.valueGood]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: grocery.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3EEF4',
    padding: 14,
    gap: 9,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 13, fontWeight: '600', color: grocery.muted },
  value: {
    fontSize: 13,
    fontWeight: '700',
    color: grocery.ink,
    fontVariant: ['tabular-nums'],
  },
  valueGood: { color: '#1F9D55' },
  rule: { height: 1, backgroundColor: '#E7F2F8', marginVertical: 1 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 14, fontWeight: '800', color: grocery.ink },
  totalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: grocery.ink,
    fontVariant: ['tabular-nums'],
  },
  totalLabelStrong: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: grocery.ink,
  },
  totalValueStrong: {
    fontSize: 21,
    fontWeight: '900',
    color: grocery.blue,
    fontVariant: ['tabular-nums'],
  },
  nudge: { fontSize: 11.5, fontWeight: '700', color: '#3E8FAE' },
});
