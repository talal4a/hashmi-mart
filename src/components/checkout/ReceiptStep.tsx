import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { Check, Home } from 'lucide-react-native';
import PressableScale from '../ui/PressableScale';
import { grocery } from '../home/groceryTheme';
import OrderSlip from './OrderSlip';
import { printReceipt, type Receipt } from '../../services/receipt';

/**
 * Step three: it is done, and here is the proof.
 *
 * The order exists in Firestore by the time this renders — nothing on this
 * screen can create, change or cancel it. Which is what makes the tear safe to
 * offer: it is paper, and tearing paper off a printer has never cancelled
 * anything. Everything here is either a copy of the record or a way out of the
 * screen.
 */
export default function ReceiptStep({
  receipt,
  onDone,
  bottomInset,
}: {
  receipt: Receipt;
  onDone: () => void;
  bottomInset: number;
}) {
  const reduced = useReducedMotion();
  const [torn, setTorn] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printNote, setPrintNote] = useState<string | null>(null);

  const print = useCallback(async () => {
    setPrinting(true);
    setPrintNote(null);
    const outcome = await printReceipt(receipt);
    setPrinting(false);
    // Says what actually happened. On a build without the print module this is
    // a share sheet, and calling that "printed" is a small lie the customer
    // can see through the moment it opens.
    if (outcome === 'shared') setPrintNote('Receipt sent');
    else if (outcome === 'failed') setPrintNote('Could not print just now');
  }, [receipt]);

  return (
    <View style={s.fill}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.body, { paddingBottom: bottomInset + 24 }]}
      >
        <Animated.View
          entering={reduced ? undefined : FadeInDown.duration(260)}
          style={s.intro}
        >
          <Text style={s.title}>Order confirmed</Text>
          <Text style={s.subtitle}>
            Your order has been placed successfully.
          </Text>
        </Animated.View>

        <OrderSlip
          receipt={receipt}
          onTorn={() => setTorn(true)}
          onPrint={print}
          printing={printing}
        />

        {printNote ? (
          <Animated.Text
            entering={reduced ? undefined : FadeIn.duration(180)}
            style={s.printNote}
          >
            {printNote}
          </Animated.Text>
        ) : null}

        {/* Only once the slip is off the machine. Offering the way out while
            the paper is still attached is what makes people leave before they
            have the reference. */}
        {torn ? (
          <Animated.View
            entering={reduced ? undefined : FadeInDown.duration(280)}
            style={s.done}
          >
            <View style={s.doneHead}>
              <View style={s.tick}>
                <Check size={14} color={grocery.white} strokeWidth={3.4} />
              </View>
              <Text style={s.doneTitle}>Order placed successfully</Text>
            </View>
            <Text style={s.doneRef} selectable>
              Order {receipt.reference}
            </Text>
            <Text style={s.doneText}>
              We will start preparing your order shortly and call to confirm
              delivery.
            </Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Back to shopping"
              onPress={onDone}
              scaleTo={0.97}
              style={s.cta}
            >
              <Home size={16} color={grocery.white} strokeWidth={2.5} />
              <Text style={s.ctaText}>Back to shopping</Text>
            </PressableScale>
          </Animated.View>
        ) : (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Back to shopping"
            onPress={onDone}
            scaleTo={0.97}
            style={s.quiet}
          >
            <Text style={s.quietText}>Back to shopping</Text>
          </PressableScale>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  body: { alignItems: 'center', paddingHorizontal: 18, paddingTop: 4, gap: 20 },
  intro: { alignItems: 'center', gap: 5 },
  title: { fontSize: 21, fontWeight: '900', color: grocery.ink },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    color: grocery.muted,
    textAlign: 'center',
  },
  printNote: { fontSize: 12.5, fontWeight: '700', color: grocery.blue },

  done: {
    alignSelf: 'stretch',
    maxWidth: 320,
    gap: 9,
    padding: 16,
    borderRadius: 20,
    backgroundColor: grocery.white,
    borderWidth: 1,
    borderColor: '#D7EFDD',
  },
  doneHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2FB56B',
  },
  doneTitle: { flex: 1, fontSize: 14.5, fontWeight: '900', color: grocery.ink },
  doneRef: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: grocery.blue,
  },
  doneText: { fontSize: 12.5, lineHeight: 18, color: grocery.muted },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    marginTop: 3,
    backgroundColor: grocery.blue,
  },
  ctaText: { fontSize: 14.5, fontWeight: '900', color: grocery.white },

  quiet: { paddingVertical: 12, paddingHorizontal: 18 },
  quietText: { fontSize: 14, fontWeight: '800', color: grocery.muted },
});
