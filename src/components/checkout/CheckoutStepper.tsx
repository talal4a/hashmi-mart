import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { checkoutColors as C } from './theme';

export default function CheckoutStepper({ step }: { step: 'review' | 'preview' | 'receipt' }) {
  const active = ['review', 'preview', 'receipt'].indexOf(step);
  const reduced = useReducedMotion();
  return (
    <View style={s.rail} accessibilityLabel={`Step ${active + 1} of 3, ${step}`}>
      {['Review', 'Preview', 'Receipt'].map((label, index) => (
        <View key={label} style={s.part}>
          {index > 0 ? <Connector filled={active >= index} /> : null}
          <View style={s.node}>
            <View style={[s.circle, index <= active && s.active, index === active && s.current]}>
              {index < active ? <Animated.View entering={FadeIn.duration(reduced ? 120 : 240)}><Check size={14} color={C.paper} strokeWidth={3} /></Animated.View> : <Text style={[s.number, index === active && s.numberActive]}>{index + 1}</Text>}
            </View>
            <Text style={[s.label, index === active && s.labelActive]}>{label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
function Connector({ filled }: { filled: boolean }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(filled ? 1 : 0);
  useEffect(() => { progress.value = withTiming(filled ? 1 : 0, { duration: reduced ? 120 : 300 }); }, [filled, progress, reduced]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  return <View style={s.connector}><Animated.View style={[s.fill, animated]} /></View>;
}
const s = StyleSheet.create({
  rail: { flexDirection: 'row', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 17, maxWidth: 600, width: '100%', alignSelf: 'center' },
  part: { flex: 1, position: 'relative', alignItems: 'center' },
  node: { alignItems: 'center', gap: 6 },
  circle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: '#C5DEE9', alignItems: 'center', justifyContent: 'center', backgroundColor: C.canvas },
  active: { backgroundColor: C.cyan, borderColor: C.cyan },
  current: { boxShadow: '0px 3px 10px rgba(8,172,224,0.22)' },
  number: { fontSize: 11, fontWeight: '800', color: C.muted }, numberActive: { color: C.paper },
  label: { fontSize: 10, fontWeight: '600', color: C.muted }, labelActive: { color: C.ink, fontWeight: '800' },
  connector: { position: 'absolute', height: 2, left: '-50%', right: '50%', top: 13, backgroundColor: C.line },
  fill: { flex: 1, backgroundColor: C.cyan, transformOrigin: 'left' },
});
