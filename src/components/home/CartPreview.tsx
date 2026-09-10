import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { Minus, Plus, ShoppingCart, X } from 'lucide-react-native';
import { freshPicks } from '../../data/groceryHome';
import ProduceArt from './ProduceArt';
import PressableScale from '../ui/PressableScale';
import { grocery } from './groceryTheme';

/** Review the current browsing session's selections; checkout is a separate flow. */
export default function CartPreview({
  visible,
  quantities,
  onAdjust,
  onClose,
}: {
  visible: boolean;
  quantities: Record<string, number>;
  onAdjust: (id: string, delta: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const items = freshPicks.filter(item => ((quantities?.[item.id]) ?? 0) > 0);
  const count = items.reduce((sum, item) => sum + (quantities?.[item.id] ?? 0), 0);
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * (quantities?.[item.id] ?? 0),
    0,
  );
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? 'none' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close cart"
        />
        <View
          accessibilityViewIsModal
          style={[
            s.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 12,
              marginTop: insets.top + 24,
            },
          ]}
        >
          <View style={s.handle} />
          <View style={s.heading}>
            <View>
              <Text style={s.title}>Your cart</Text>
              <Text style={s.subtitle}>
                {count} {count === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Close cart"
              onPress={onClose}
              style={s.close}
            >
              <X size={21} color={grocery.ink} />
            </PressableScale>
          </View>
          {items.length ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.items}
            >
              {items.map(item => (
                <View key={item.id} style={s.item}>
                  <View style={s.art}>
                    <ProduceArt index={item.art} size={58} radius={14} />
                  </View>
                  <View style={s.details}>
                    <Text style={s.name}>{item.name}</Text>
                    <Text style={s.subtitle}>{item.meta}</Text>
                    <Text style={s.price}>
                      Rs. {item.price * quantities[item.id]}
                    </Text>
                  </View>
                  <View style={s.stepper}>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={`Remove one ${item.name}`}
                      onPress={() => onAdjust(item.id, -1)}
                      style={s.step}
                    >
                      <Minus size={16} color={grocery.blue} />
                    </PressableScale>
                    <Text style={s.quantity}>{quantities[item.id]}</Text>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={`Add another ${item.name}`}
                      onPress={() => onAdjust(item.id, 1)}
                      style={s.step}
                    >
                      <Plus size={16} color={grocery.blue} />
                    </PressableScale>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <ShoppingCart size={31} color={grocery.blue} />
              </View>
              <Text style={s.emptyTitle}>Your cart is empty</Text>
              <Text style={s.subtitle}>
                Add your fresh picks to see them here.
              </Text>
            </View>
          )}
          {items.length ? (
            <View style={s.total}>
              <Text style={s.name}>Subtotal</Text>
              <Text style={s.totalPrice}>
                Rs. {subtotal.toLocaleString('en-PK')}
              </Text>
            </View>
          ) : null}
          <PressableScale
            accessibilityRole="button"
            onPress={onClose}
            style={s.continue}
          >
            <Text style={s.continueLabel}>Continue shopping</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#0B1F2A55',
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    backgroundColor: grocery.canvas,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4E4EC',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    color: grocery.ink,
    letterSpacing: -0.6,
  },
  subtitle: { fontSize: 12, color: grocery.muted, lineHeight: 18 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9F3F8',
  },
  items: { gap: 14, paddingVertical: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCEAF1',
  },
  art: {
    width: 58,
    height: 58,
    backgroundColor: '#E8F7FD',
    borderRadius: 14,
    overflow: 'hidden',
  },
  details: { flex: 1 },
  name: { fontSize: 13, fontWeight: '600', color: grocery.ink },
  price: { fontSize: 13, fontWeight: '700', color: grocery.ink, marginTop: 3 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#E6F5FC',
  },
  step: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    minWidth: 16,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: grocery.ink,
  },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 26 },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 25,
    backgroundColor: '#E4F5FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: grocery.ink },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  totalPrice: { fontSize: 20, fontWeight: '700', color: grocery.ink },
  continue: {
    minHeight: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: grocery.blue,
    marginTop: 8,
  },
  continueLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});
