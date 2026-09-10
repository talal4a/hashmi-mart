import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { ArrowLeftRight, Minus, Plus, Trash2 } from 'lucide-react-native';
import PressableScale from '../ui/PressableScale';
import ProduceArt from '../home/ProduceArt';
import type { CartLine } from '../../state/cart';
import { checkoutColors as C, checkoutMoney as money } from './theme';

export default memo(function CheckoutItemCard({ line, onQuantity, onRemove, onChange, unavailable }: {
  line: CartLine; onQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void; onChange: (id: string) => void; unavailable?: boolean;
}) {
  const reduced = useReducedMotion();
  const [draft, setDraft] = useState(String(line.quantity));
  useEffect(() => { setDraft(String(line.quantity)); }, [line.quantity]);
  const commit = () => {
    const quantity = Number(draft);
    if (Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 999) onQuantity(line.id, quantity);
    else setDraft(String(line.quantity));
  };
  return (
    <Animated.View layout={reduced ? undefined : LinearTransition.duration(220)} entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={s.card}>
      <View style={s.top}>
        <View style={s.art}><ProduceArt index={line.art} size={65} /></View>
        <View style={s.identity}><Text style={s.name}>{line.name}</Text><Text style={s.meta}>{line.meta}</Text><Text style={s.unitPrice}>{money(line.price)} each</Text></View>
        <PressableScale accessibilityRole="button" accessibilityLabel={`Remove ${line.name}`} onPress={() => onRemove(line.id)} style={s.remove}><Trash2 size={17} color={C.muted} /></PressableScale>
      </View>
      {unavailable ? <Text style={s.warning}>This item is currently unavailable. Choose a replacement.</Text> : null}
      <View style={s.bottom}>
        <View style={s.quantity}>
          <PressableScale accessibilityRole="button" accessibilityLabel={`Decrease ${line.name} quantity`} onPress={() => line.quantity === 1 ? onRemove(line.id) : onQuantity(line.id, line.quantity - 1)} style={s.step}><Minus size={16} color={C.cyanDark} /></PressableScale>
          <TextInput accessibilityLabel={`${line.name} quantity`} keyboardType="number-pad" selectTextOnFocus value={draft} maxLength={3} onChangeText={value => { setDraft(value); const number = Number(value); if (value && Number.isSafeInteger(number) && number >= 1 && number <= 999) onQuantity(line.id, number); }} onBlur={commit} onSubmitEditing={commit} style={s.quantityText} />
          <PressableScale accessibilityRole="button" accessibilityLabel={`Increase ${line.name} quantity`} disabled={line.quantity >= 999} onPress={() => onQuantity(line.id, line.quantity + 1)} style={s.step}><Plus size={16} color={C.cyanDark} /></PressableScale>
        </View>
        <Animated.Text key={line.total} entering={FadeIn.duration(150)} style={s.price}>{money(line.total)}</Animated.Text>
      </View>
      <PressableScale accessibilityRole="button" accessibilityLabel={`Change ${line.name}`} onPress={() => onChange(line.id)} style={s.change}><ArrowLeftRight size={13} color={C.cyanDark} /><Text style={s.changeText}>Change product or size</Text></PressableScale>
    </Animated.View>
  );
});
const s = StyleSheet.create({
  card: { backgroundColor: C.paper, padding: 16, borderRadius: 23, borderWidth: 1, borderColor: C.line, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 }, art: { backgroundColor: C.canvas, borderRadius: 18, overflow: 'hidden' },
  identity: { flex: 1, gap: 4 }, name: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: C.ink },
  meta: { color: C.muted, fontSize: 11, lineHeight: 16 }, unitPrice: { color: C.cyanDark, fontSize: 11, fontWeight: '600' },
  remove: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quantity: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.pale, borderRadius: 13 },
  step: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  quantityText: { width: 34, padding: 0, textAlign: 'center', fontSize: 14, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  price: { fontSize: 19, fontWeight: '800', color: C.ink, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  change: { minHeight: 34, flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start' },
  changeText: { fontSize: 11, fontWeight: '700', color: C.cyanDark }, warning: { fontSize: 12, lineHeight: 18, color: C.amber },
});
