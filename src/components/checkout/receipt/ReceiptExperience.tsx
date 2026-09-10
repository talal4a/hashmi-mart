import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import { ArrowRight, CheckCircle2, Printer, Scissors, Truck } from 'lucide-react-native';
import PressableScale from '../../ui/PressableScale';
import ReceiptPrinter, { type ReceiptPhase } from './ReceiptPrinter';
import { receiptHTML } from './receiptModel';
import type { ReceiptOrder } from './types';

export default function ReceiptExperience({
  order,
  onTrack,
  onDone,
}: {
  order: ReceiptOrder;
  onTrack: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<ReceiptPhase>('printing');
  const [printError, setPrintError] = useState<string | null>(null);

  const handlePrinted = useCallback(() => {
    setPhase('ready');
  }, []);

  const handleTear = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setPhase('tearing');
  }, []);

  const handleTorn = useCallback(() => {
    setPhase('done');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const handlePrintDocument = useCallback(async () => {
    setPrintError(null);
    try {
      await Print.printAsync({ html: receiptHTML(order) });
    } catch {
      setPrintError("Couldn't open printing. Please try again.");
    }
  }, [order]);

  return (
    <View style={s.container}>
      {/* Sleek Metallic Receipt Machine */}
      <ReceiptPrinter
        order={order}
        phase={phase}
        onPrinted={handlePrinted}
        onTorn={handleTorn}
      />

      {printError ? (
        <Text accessibilityLiveRegion="polite" style={s.errorText}>
          {printError}
        </Text>
      ) : null}

      {/* Action Controls */}
      <View style={s.actions}>
        {phase === 'ready' ? (
          <>
            {/* Primary Action: Tear It */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Tear It"
              onPress={handleTear}
              scaleTo={0.96}
              style={s.tearButton}
            >
              <Scissors size={20} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={s.tearButtonText}>Tear It</Text>
            </PressableScale>

            {/* Secondary Action: Native Print / Save PDF */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Print Receipt"
              onPress={handlePrintDocument}
              scaleTo={0.96}
              style={s.printButton}
            >
              <Printer size={18} color="#334155" strokeWidth={2.2} />
              <Text style={s.printButtonText}>Print Receipt</Text>
            </PressableScale>
          </>
        ) : null}

        {phase === 'done' ? (
          <>
            {/* Order Confirmation Card */}
            <View style={s.confirmedCard}>
              <CheckCircle2 size={24} color="#059669" strokeWidth={2.4} />
              <View style={s.confirmedTextGroup}>
                <Text style={s.confirmedTitle}>Order Placed Successfully!</Text>
                <Text style={s.confirmedSubtitle}>
                  Order #{order.reference} • Cash on Delivery
                </Text>
              </View>
            </View>

            {/* Track Order */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Track Order"
              onPress={onTrack}
              scaleTo={0.96}
              style={s.trackButton}
            >
              <Truck size={20} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={s.trackButtonText}>Track Order</Text>
            </PressableScale>

            {/* Back to Shopping */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Back to shopping"
              onPress={onDone}
              scaleTo={0.96}
              style={s.doneButton}
            >
              <Text style={s.doneButtonText}>Back to shopping</Text>
              <ArrowRight size={18} color="#475569" strokeWidth={2.2} />
            </PressableScale>
          </>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 32,
    width: '100%',
  },
  actions: {
    width: '100%',
    maxWidth: 324,
    gap: 12,
    marginTop: 12,
  },
  tearButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#0F172A',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  tearButtonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  printButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  printButtonText: {
    color: '#334155',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  confirmedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 4,
  },
  confirmedTextGroup: {
    flex: 1,
  },
  confirmedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
  },
  confirmedSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
  },
  trackButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#059669',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  trackButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  doneButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  doneButtonText: {
    color: '#334155',
    fontSize: 13.5,
    fontWeight: '700',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
});
