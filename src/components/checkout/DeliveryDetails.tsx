import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronDown, MapPin, X } from 'lucide-react-native';
import PressableScale from '../ui/PressableScale';
import { DELIVERY_AREAS } from '../../services/deliveryAreas';
import { checkoutColors as C } from './theme';

export type DeliveryForm = { name: string; phone: string; area: string; address: string; instructions: string };
export default function DeliveryDetails({ value, onChange, errors }: { value: DeliveryForm; onChange: (key: keyof DeliveryForm, value: string) => void; errors: Partial<Record<keyof DeliveryForm, string>> }) {
  const [areasOpen, setAreasOpen] = useState(false);
  return <View style={s.card}>
    <View style={s.heading}><View style={s.icon}><MapPin size={20} color={C.cyanDark} /></View><View style={s.flex}><Text style={s.title}>Delivery details</Text><Text style={s.hint}>Changes apply to this order only.</Text></View></View>
    <Field label="Name" accessibilityLabel="Delivery name" value={value.name} onChangeText={text => onChange('name', text)} error={errors.name} autoComplete="name" />
    <Field label="Phone" accessibilityLabel="Delivery phone" value={value.phone} onChangeText={text => onChange('phone', text)} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" />
    {DELIVERY_AREAS.length ? <View style={s.field}><Text style={s.label}>Area</Text><PressableScale accessibilityRole="button" accessibilityLabel="Delivery area" onPress={() => setAreasOpen(true)} style={[s.input, s.area]}><Text style={value.area ? s.areaValue : s.hint}>{value.area || 'Choose delivery area'}</Text><ChevronDown size={17} color={C.cyanDark} /></PressableScale>{errors.area ? <Text style={s.error}>{errors.area}</Text> : null}</View> : <Field label="Area" accessibilityLabel="Delivery area" value={value.area} onChangeText={text => onChange('area', text)} error={errors.area} placeholder="Your neighbourhood or delivery area" />}
    <Field label="Address" accessibilityLabel="Delivery address" value={value.address} onChangeText={text => onChange('address', text)} error={errors.address} multiline autoComplete="street-address" placeholder="House, street and nearby landmark" />
    <Field label="Order instructions · optional" accessibilityLabel="Order instructions" value={value.instructions} onChangeText={text => onChange('instructions', text)} multiline placeholder="e.g. Please call before delivery" maxLength={500} />
    <Modal visible={areasOpen} transparent animationType="fade" onRequestClose={() => setAreasOpen(false)}><View style={s.overlay}><View style={s.areaSheet} accessibilityViewIsModal><View style={s.heading}><Text style={[s.title, s.flex]}>Delivery area</Text><PressableScale accessibilityRole="button" accessibilityLabel="Close delivery areas" onPress={() => setAreasOpen(false)} style={s.close}><X size={20} color={C.ink} /></PressableScale></View><ScrollView>{DELIVERY_AREAS.map(area => <PressableScale key={area} accessibilityRole="button" accessibilityLabel={`Deliver to ${area}`} onPress={() => { onChange('area', area); setAreasOpen(false); }} style={s.areaOption}><Text style={s.areaValue}>{area}</Text>{value.area === area ? <Check size={18} color={C.cyanDark} /> : null}</PressableScale>)}</ScrollView></View></View></Modal>
  </View>;
}
function Field({ label, error, ...props }: React.ComponentProps<typeof TextInput> & { label: string; error?: string }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput {...props} placeholderTextColor={C.muted} style={[s.input, props.multiline && s.multiline, error && s.inputError]} />{error ? <Text style={s.error}>{error}</Text> : null}</View>;
}
const s = StyleSheet.create({
  card: { padding: 18, borderRadius: 24, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 3 },
  icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 4 }, title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4, color: C.ink }, hint: { color: C.muted, fontSize: 11, lineHeight: 17 },
  field: { gap: 7 }, label: { color: C.ink, fontSize: 11, fontWeight: '700' },
  input: { color: C.ink, fontSize: 14, lineHeight: 21, paddingHorizontal: 13, paddingVertical: 13, borderWidth: 1, borderColor: C.line, backgroundColor: C.canvas, borderRadius: 13, minHeight: 48 },
  multiline: { minHeight: 76, textAlignVertical: 'top' }, inputError: { borderColor: '#DFBD87' }, error: { color: C.amber, fontSize: 11, lineHeight: 16 },
  area: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, areaValue: { color: C.ink, fontSize: 14, flexShrink: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(11,41,54,0.3)', justifyContent: 'center', padding: 24 },
  areaSheet: { backgroundColor: C.paper, borderRadius: 25, padding: 22, maxHeight: '75%' }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  areaOption: { minHeight: 54, paddingVertical: 12, borderBottomWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
