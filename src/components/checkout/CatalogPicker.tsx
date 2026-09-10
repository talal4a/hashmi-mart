import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, X, Plus, ArrowLeftRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from '../ui/PressableScale';
import ProduceArt from '../home/ProduceArt';
import { getCheckoutCatalog } from '../../services/checkout';
import { checkoutColors as C, checkoutMoney as money } from './theme';

export default function CatalogPicker({ replaceName, onClose, onChoose }: { replaceName: string | null; onClose: () => void; onChoose: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const products = useMemo(() => getCheckoutCatalog().filter(product => `${product.name} ${product.unit}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [query]);
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
      <PressableScale accessibilityRole="button" accessibilityLabel="Close catalog" onPress={onClose} style={s.backdrop}><View /></PressableScale>
      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]} accessibilityViewIsModal>
        <View style={s.handle} /><View style={s.head}><View style={s.flex}><Text style={s.title}>{replaceName ? 'Choose a replacement' : 'Add something fresh'}</Text><Text style={s.subtitle}>{replaceName ? `Replacing ${replaceName}` : 'From the HashmiMart catalog'}</Text></View><PressableScale accessibilityRole="button" accessibilityLabel="Close product search" onPress={onClose} style={s.close}><X size={20} color={C.ink} /></PressableScale></View>
        <View style={s.search}><Search size={18} color={C.muted} /><TextInput accessibilityLabel="Search catalog" value={query} onChangeText={setQuery} placeholder="Search products or sizes" placeholderTextColor={C.muted} autoCorrect={false} style={s.input} /></View>
        <FlatList data={products} keyExtractor={product => product.id} keyboardShouldPersistTaps="handled" contentContainerStyle={s.list} renderItem={({ item }) => <PressableScale accessibilityRole="button" accessibilityLabel={`${replaceName ? 'Choose' : 'Add'} ${item.name}`} disabled={!item.available} onPress={() => onChoose(item.id)} style={[s.item, !item.available && s.disabled]}><View style={s.art}><ProduceArt index={item.art} size={58} /></View><View style={s.flex}><Text style={s.name}>{item.name}</Text><Text style={s.subtitle}>{item.unit} · {money(item.price)}</Text>{!item.available ? <Text style={s.unavailable}>Currently unavailable</Text> : null}</View><View style={s.add}>{replaceName ? <ArrowLeftRight size={17} color={C.cyanDark} /> : <Plus size={19} color={C.cyanDark} />}</View></PressableScale>} ListEmptyComponent={<Text style={s.empty}>No products match “{query}”. Try a different name.</Text>} />
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,41,54,0.3)' }, backdrop: { ...StyleSheet.absoluteFill },
  sheet: { backgroundColor: C.paper, paddingHorizontal: 22, paddingTop: 10, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '82%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 19 }, flex: { flex: 1, gap: 5 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.7, color: C.ink }, subtitle: { fontSize: 12, color: C.muted, lineHeight: 17 },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.canvas, borderWidth: 1, borderColor: C.line, borderRadius: 15, paddingHorizontal: 15, minHeight: 50 },
  input: { flex: 1, color: C.ink, fontSize: 14, paddingVertical: 14 }, list: { paddingVertical: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderColor: C.line }, art: { borderRadius: 16, overflow: 'hidden', backgroundColor: C.canvas },
  name: { color: C.ink, fontSize: 14, fontWeight: '700' }, add: { backgroundColor: C.pale, width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 30, fontSize: 14, color: C.muted, lineHeight: 22 }, unavailable: { color: C.amber, fontSize: 11 }, disabled: { opacity: 0.5 },
});
