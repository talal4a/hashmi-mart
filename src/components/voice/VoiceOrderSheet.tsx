import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated';
import { Check, TriangleAlert, X } from 'lucide-react-native';
import PressableScale from '../ui/PressableScale';
import { grocery } from '../home/groceryTheme';
import useVoiceRecorder, { formatDuration } from '../../hooks/useVoiceRecorder';
import useVoiceOrder from '../../hooks/useVoiceOrder';
import type { CatalogMatch } from '../../services/voiceCatalog';
import AnimatedMic from './AnimatedMic';
import VoiceWaveform from './VoiceWaveform';
import { tapCancel, tapHandoff, tapRecordStart, tapSend } from './haptics';

/**
 * Voice Order, end to end.
 *
 * The sheet's job is to make the fallback always visible. Every state past
 * recording offers "Send voice to store" alongside whatever the AI managed, so
 * a customer who has spoken a forty-second order is never told to start again —
 * the recording they already made is a complete order on its own, and the
 * interpretation is a convenience on top of it.
 *
 * Which is why nothing here is gated on the AI succeeding. The review screen
 * renders with items, without items, with a transcript and no items, and with
 * neither; in all four the send button is the same button.
 */

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Adds a confirmed item to the cart. Same path the product cards use. */
  onAddToCart: (productId: string, quantity: number) => void;
};

export default function VoiceOrderSheet({ visible, onClose, onAddToCart }: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const recorder = useVoiceRecorder();
  const order = useVoiceOrder();

  // Opening the sheet starts listening. Tapping a microphone and then having to
  // tap another one is a step nobody wants.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      const started = await recorder.start();
      if (started && !cancelled) tapRecordStart();
    })();
    return () => {
      cancelled = true;
    };
    // Only on open: re-running this on every recorder change would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = useCallback(() => {
    void recorder.cancel();
    order.reset();
    onClose();
  }, [recorder, order, onClose]);

  const finish = useCallback(async () => {
    const result = await recorder.stop();
    if (!result) return;
    tapSend();
    await order.interpret(result);
  }, [recorder, order]);

  /**
   * Adds the matched items, one after another.
   *
   * Staggered rather than simultaneous: three flights leaving at once read as
   * one blurred movement, and the cart's reaction fires three times over itself.
   * 160ms apart is enough to see each land.
   */
  const confirmAll = useCallback(() => {
    order.addable.forEach((match, index) => {
      setTimeout(() => {
        onAddToCart(match.productId!, match.quantity);
      }, index * 160);
    });
    tapHandoff();
    setTimeout(close, order.addable.length * 160 + 260);
  }, [order.addable, onAddToCart, close]);

  const sendOriginal = useCallback(() => {
    tapSend();
    void order.sendToStore();
  }, [order]);

  const enter = reduced ? undefined : FadeInDown.duration(240);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      <View style={s.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Close voice order"
          onPress={close}
        />
        <Animated.View
          entering={enter}
          style={[s.sheet, { paddingBottom: insets.bottom + 18 }]}
        >
          <View style={s.head}>
            <Text style={s.title}>Voice Order</Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={close}
              scaleTo={0.9}
              hitSlop={10}
              style={s.close}
            >
              <X size={18} color={grocery.muted} strokeWidth={2.2} />
            </PressableScale>
          </View>

          {recorder.recording ? (
            <RecordingView
              levels={recorder.levels}
              durationMs={recorder.durationMs}
              onCancel={close}
              onDone={finish}
            />
          ) : order.stage === 'transcribing' || order.stage === 'understanding' ? (
            <Working
              label={
                order.stage === 'transcribing'
                  ? 'Listening to your order…'
                  : 'Understanding your order…'
              }
            />
          ) : order.stage === 'sending' ? (
            <Working label="Sending to HashmiMart…" />
          ) : order.stage === 'sent' ? (
            <Sent reference={order.reference} onDone={close} />
          ) : (
            <Review
              order={order}
              onConfirm={confirmAll}
              onSend={sendOriginal}
              onSetQuantity={order.setQuantity}
            />
          )}

          {recorder.status === 'denied' ? (
            <Text style={s.note}>
              Microphone access is off. Enable it in Settings to record an order.
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

function RecordingView({
  levels,
  durationMs,
  onCancel,
  onDone,
}: {
  levels: ReturnType<typeof useVoiceRecorder>['levels'];
  durationMs: number;
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <View style={s.body}>
      <Text style={s.lead}>
        Say what you need — Urdu, Punjabi or English.
      </Text>
      <View style={s.meter}>
        <AnimatedMic recording size={48} />
        <VoiceWaveform levels={levels} height={42} />
      </View>
      <Text style={s.timer}>{formatDuration(durationMs)}</Text>
      <View style={s.row}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Cancel recording"
          onPress={onCancel}
          scaleTo={0.95}
          style={s.ghost}
        >
          <Text style={s.ghostText}>Cancel</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Done recording"
          onPress={onDone}
          scaleTo={0.95}
          style={s.primary}
        >
          <Text style={s.primaryText}>Done</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function Working({ label }: { label: string }) {
  return (
    <View style={[s.body, s.working]}>
      <ActivityIndicator color={grocery.blue} />
      <Text style={s.lead}>{label}</Text>
    </View>
  );
}

function Sent({
  reference,
  onDone,
}: {
  reference: string | null;
  onDone: () => void;
}) {
  return (
    <View style={[s.body, s.working]}>
      <View style={s.tick}>
        <Check size={22} color="#FFFFFF" strokeWidth={3} />
      </View>
      <Text style={s.title}>Voice order sent</Text>
      <Text style={s.lead}>
        HashmiMart has your recording and will call to confirm.
      </Text>
      {reference ? (
        <Text style={s.reference} selectable>
          Reference {reference}
        </Text>
      ) : null}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Done"
        onPress={onDone}
        scaleTo={0.95}
        style={s.primary}
      >
        <Text style={s.primaryText}>Done</Text>
      </PressableScale>
    </View>
  );
}

function Review({
  order,
  onConfirm,
  onSend,
  onSetQuantity,
}: {
  order: ReturnType<typeof useVoiceOrder>;
  onConfirm: () => void;
  onSend: () => void;
  onSetQuantity: (index: number, quantity: number) => void;
}) {
  const reduced = useReducedMotion();
  return (
    <View style={s.body}>
      {order.transcript ? (
        <View style={s.heard}>
          <Text style={s.heardLabel}>You said</Text>
          <Text style={s.heardText}>{order.transcript}</Text>
        </View>
      ) : (
        <Text style={s.lead}>
          {order.error
            ? order.error
            : "That recording came through quiet — but you can still send it."}
        </Text>
      )}

      {order.matches.length > 0 ? (
        <ScrollView style={s.items} contentContainerStyle={s.itemsInner}>
          {order.matches.map((match, index) => (
            <Animated.View
              key={`${match.query}-${index}`}
              entering={reduced ? undefined : FadeIn.delay(index * 70).duration(220)}
              exiting={reduced ? undefined : FadeOut.duration(120)}
            >
              <ItemRow
                match={match}
                onSetQuantity={next => onSetQuantity(index, next)}
              />
            </Animated.View>
          ))}
        </ScrollView>
      ) : null}

      {/* Always present, whatever the AI managed. This is the order that
          cannot fail to be placeable. */}
      <View style={s.actions}>
        {order.addable.length > 0 ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Confirm and add ${order.addable.length} items`}
            onPress={onConfirm}
            scaleTo={0.96}
            style={s.primary}
          >
            <Text style={s.primaryText}>
              Confirm &amp; add {order.addable.length}
            </Text>
          </PressableScale>
        ) : null}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Send voice order to the store"
          onPress={onSend}
          scaleTo={0.96}
          style={order.addable.length > 0 ? s.ghostWide : s.primary}
        >
          <Text style={order.addable.length > 0 ? s.ghostText : s.primaryText}>
            Send voice to store
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

/**
 * One detected item.
 *
 * An item we could not match is shown rather than hidden, greyed and with a
 * warning — a silently dropped item is how an order arrives short, and the
 * customer is the only one who can tell us what they meant.
 */
function ItemRow({
  match,
  onSetQuantity,
}: {
  match: CatalogMatch;
  onSetQuantity: (quantity: number) => void;
}) {
  const matched = Boolean(match.productId);
  const unsure = match.confidence !== 'high';

  return (
    <View style={[s.item, !matched && s.itemUnmatched]}>
      <View style={s.itemText}>
        <Text style={[s.itemName, !matched && s.itemNameMuted]} numberOfLines={1}>
          {match.productName ?? match.query}
        </Text>
        <Text style={s.itemMeta} numberOfLines={1}>
          {matched
            ? `${match.quantity}${match.unit ? ` ${match.unit}` : ''}${
                unsure ? ' · please check' : ''
              }`
            : 'Not sold here — send the recording instead'}
        </Text>
      </View>

      {unsure ? (
        <TriangleAlert size={15} color="#D8853F" strokeWidth={2.2} />
      ) : null}

      {matched ? (
        <View style={s.stepper}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Less ${match.productName}`}
            onPress={() => onSetQuantity(Math.max(0, match.quantity - 1))}
            scaleTo={0.9}
            hitSlop={6}
            style={s.step}
          >
            <Text style={s.stepText}>−</Text>
          </PressableScale>
          <Text style={s.stepQty}>{match.quantity}</Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`More ${match.productName}`}
            onPress={() => onSetQuantity(match.quantity + 1)}
            scaleTo={0.9}
            hitSlop={6}
            style={s.step}
          >
            <Text style={s.stepText}>+</Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0B1F2A66' },
  sheet: {
    backgroundColor: '#F7FCFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 14,
    maxHeight: '86%',
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: grocery.ink },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7F4FA',
  },

  body: { gap: 14, paddingTop: 14 },
  working: { alignItems: 'center', paddingVertical: 26 },
  lead: {
    fontSize: 13.5,
    lineHeight: 19,
    color: grocery.muted,
    textAlign: 'center',
  },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  timer: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: grocery.muted,
    fontVariant: ['tabular-nums'],
  },

  heard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCEFF8',
    padding: 12,
    gap: 3,
  },
  heardLabel: { fontSize: 10.5, fontWeight: '700', color: grocery.muted },
  heardText: {
    fontSize: 14,
    lineHeight: 20,
    color: grocery.ink,
    writingDirection: 'auto',
  },

  items: { maxHeight: 260 },
  itemsInner: { gap: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCEFF8',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemUnmatched: { backgroundColor: '#F3F6F8', borderColor: '#E1E8EC' },
  itemText: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: '700', color: grocery.ink },
  itemNameMuted: { color: '#8B9BA6' },
  itemMeta: { fontSize: 11.5, color: grocery.muted },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7F4FA',
  },
  stepText: { fontSize: 15, fontWeight: '700', color: grocery.blue },
  stepQty: {
    minWidth: 16,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: grocery.ink,
  },

  actions: { gap: 8 },
  row: { flexDirection: 'row', gap: 10 },
  primary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 22,
    backgroundColor: grocery.blue,
  },
  primaryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  ghost: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 22,
    backgroundColor: '#E7F4FA',
  },
  ghostWide: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 22,
    backgroundColor: '#E7F4FA',
  },
  ghostText: { fontSize: 14, fontWeight: '700', color: '#2C6B87' },

  tick: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2FB56B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reference: { fontSize: 12, fontWeight: '700', color: grocery.blue },
  note: {
    fontSize: 11.5,
    lineHeight: 16,
    color: grocery.muted,
    textAlign: 'center',
    paddingTop: 10,
  },
});
