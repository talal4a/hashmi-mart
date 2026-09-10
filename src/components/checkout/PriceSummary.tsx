import { StyleSheet, Text, View } from 'react-native';
import { checkoutColors as C, checkoutMoney as money } from './theme';
export default function PriceSummary({ subtotal, deliveryFee, discount, total, preview = false }: { subtotal: number; deliveryFee: number; discount: number; total: number; preview?: boolean }) {
  return <View style={s.card}>
    <Row label="Subtotal" value={money(subtotal)} />
    <Row label="Delivery" value={deliveryFee === 0 ? 'Free' : money(deliveryFee)} />
    {discount > 0 ? <Row label="Discount" value={`−${money(discount)}`} /> : null}
    <View style={s.rule} /><View style={s.row}><Text style={s.totalLabel}>{preview ? 'Total to pay' : 'Estimated total'}</Text><Text style={s.total}>{money(total)}</Text></View>
    <Text style={s.note}>{deliveryFee ? 'Free delivery on orders of Rs. 1,500 or more.' : 'Delivery is on us.'}</Text>
  </View>;
}
function Row({ label, value }: { label: string; value: string }) { return <View style={s.row}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>; }
const s = StyleSheet.create({
  card: { backgroundColor: C.paper, borderRadius: 23, borderWidth: 1, borderColor: C.line, padding: 20, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  label: { fontSize: 13, color: C.muted }, value: { fontSize: 13, fontWeight: '600', color: C.ink, fontVariant: ['tabular-nums'] },
  rule: { borderTopWidth: 1, borderColor: C.line, borderStyle: 'dashed', marginVertical: 3 },
  totalLabel: { color: C.ink, fontSize: 14, fontWeight: '800' }, total: { fontSize: 24, color: C.ink, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  note: { color: C.muted, fontSize: 10, lineHeight: 16 },
});
