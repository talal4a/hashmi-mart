import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LayoutRectangle } from 'react-native';
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

/**
 * A confirmed item, and where on screen the customer saw it.
 *
 * The origin travels with it because the flight has to leave from the row that
 * was on screen a moment ago. It is measured here, while the sheet is still up
 * and the row still exists; by the time anything flies, both are gone.
 */
export type ConfirmedVoiceItem = {
  productId: string;
  quantity: number;
  origin?: { x: number; y: number; size: number };
};

/** Everything about the order that is not an item. */
export type ConfirmedVoiceOrder = {
  transcript: string | null;
  /** Things that were asked for and are not on the shelf. */
  missed: string[];
  /** The recording, so checkout can play back what was actually said. */
  recording: { uri: string; durationMs: number } | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * Hands over everything the customer confirmed, at once.
   *
   * The screen owns what happens next — the items fly into the cart and the
   * order goes to checkout — because none of it can happen from in here: a
   * Modal is its own window, drawn above the flight layer, so anything launched
   * while this sheet is up would travel behind it.
   */
  onConfirm: (items: ConfirmedVoiceItem[], order: ConfirmedVoiceOrder) => void;
};

export default function VoiceOrderSheet({ visible, onClose, onConfirm }: Props) {
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

  /**
   * The pending auto-confirm, so closing the sheet cancels it.
   *
   * Without this, tapping X during the moment the matches are on screen still
   * fills the cart and opens checkout a beat later — from a screen the customer
   * has already dismissed.
   */
  const handover = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHandover = useCallback(() => {
    if (handover.current) clearTimeout(handover.current);
    handover.current = null;
  }, []);

  const close = useCallback(() => {
    cancelHandover();
    void recorder.cancel();
    order.reset();
    onClose();
  }, [cancelHandover, recorder, order, onClose]);

  const finish = useCallback(async () => {
    const result = await recorder.stop();
    if (!result) return;
    tapSend();
    await order.interpret(result);
  }, [recorder, order]);

  /**
   * Where each matched row is, in window coordinates.
   *
   * Keyed by product rather than by list position: rows re-render whenever a
   * quantity changes, and an index is only stable until an item is zeroed out.
   */
  const rows = useRef(new Map<string, LayoutRectangle>());

  const measureRow = useCallback(
    (productId: string, frame: LayoutRectangle) => {
      rows.current.set(productId, frame);
    },
    [],
  );

  /**
   * Hands the confirmed items up, then gets out of the way.
   *
   * The measuring has to happen now. Once this sheet dismisses the rows are
   * unmounted and there is nothing left to ask where it was, so each item
   * carries its own origin and the screen launches the flights after the sheet
   * is gone.
   */
  const confirmAll = useCallback(() => {
    const items: ConfirmedVoiceItem[] = order.addable.map(match => {
      const productId = match.productId as string;
      const frame = rows.current.get(productId);
      return {
        productId,
        quantity: match.quantity,
        origin: frame
          ? {
              // What flies is a square illustration, so it leaves from the
              // middle of the row rather than its top-left corner.
              size: FLIGHT_SIZE,
              x: frame.x + frame.width / 2 - FLIGHT_SIZE / 2,
              y: frame.y + frame.height / 2 - FLIGHT_SIZE / 2,
            }
          : undefined,
      };
    });
    cancelHandover();
    tapHandoff();
    // Read before the reset below wipes it. Checkout shows it back, so the
    // shopkeeper and the customer are looking at the same sentence when the
    // items were matched out of Urdu or Punjabi.
    const transcript = order.transcript || null;
    // Carried rather than dropped. The sheet is only up for a moment now, so
    // an item we cannot sell has to be said somewhere the customer will
    // actually read it — otherwise the order simply arrives short.
    const missed = order.matches
      .filter(match => !match.productId)
      .map(match => match.query);
    const recording = order.recording
      ? { uri: order.recording.uri, durationMs: order.recording.durationMs }
      : null;
    // Note the order: the sheet's own recorder is released, but the file it
    // wrote is not touched. Checkout plays it back.
    void recorder.cancel();
    order.reset();
    onConfirm(items, { transcript, missed, recording });
  }, [order, recorder, onConfirm, cancelHandover]);

  /**
   * Found items go to the cart on their own.
   *
   * There used to be a Confirm button here, and a customer who had already
   * said what they wanted had to say it again by tapping. Worse, when the
   * matching came back empty the only button left was "Send voice to store",
   * so an order the app could have filled ended on a screen promising a phone
   * call back — which is not what anyone asked for by speaking into a grocery
   * app.
   *
   * The pause before the handover is not hesitation. The matches are on screen
   * for a moment so the customer sees what was understood, which matters most
   * for Urdu and Punjabi, and the rows use it to measure themselves so each
   * item's flight leaves from the row it is drawn in. Nothing is being decided
   * in it: the real review is checkout, where the transcript sits above the
   * items and every quantity is still editable.
   */
  useEffect(() => {
    if (order.stage !== 'review' || order.addable.length === 0) return;
    if (handover.current) return;
    handover.current = setTimeout(confirmAll, HANDOVER_DELAY_MS);
  }, [order.stage, order.addable.length, confirmAll]);

  // A sheet reopened after a handover must not still be holding the old one.
  useEffect(() => {
    if (!visible) cancelHandover();
  }, [visible, cancelHandover]);

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
              onSend={sendOriginal}
              onSetQuantity={order.setQuantity}
              onMeasureRow={measureRow}
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
  onSend,
  onSetQuantity,
  onMeasureRow,
}: {
  order: ReturnType<typeof useVoiceOrder>;
  onSend: () => void;
  onSetQuantity: (index: number, quantity: number) => void;
  onMeasureRow: (productId: string, frame: LayoutRectangle) => void;
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
                onMeasure={onMeasureRow}
              />
            </Animated.View>
          ))}
        </ScrollView>
      ) : null}

      {/* One outcome or the other, never both.
          The recording is the fallback for an order the app could not read,
          and offering it beside items that are already on their way to the
          cart reads as a choice the customer has to make — which is how
          speaking a perfectly stocked order ended on a screen promising a
          phone call back. When we know what was wanted, we get it; when we do
          not, the recording is still a complete order on its own. */}
      <View style={s.actions}>
        {order.addable.length > 0 ? (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`Adding ${order.addable.length} items to your cart`}
            style={s.handing}
          >
            <ActivityIndicator color={grocery.blue} size="small" />
            <Text style={s.handingText}>
              Adding {order.addable.length}{' '}
              {order.addable.length === 1 ? 'item' : 'items'} to your cart…
            </Text>
          </View>
        ) : (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Send voice order to the store"
            onPress={onSend}
            scaleTo={0.96}
            style={s.primary}
          >
            <Text style={s.primaryText}>Send voice to store</Text>
          </PressableScale>
        )}
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
  onMeasure,
}: {
  match: CatalogMatch;
  onSetQuantity: (quantity: number) => void;
  onMeasure: (productId: string, frame: LayoutRectangle) => void;
}) {
  const matched = Boolean(match.productId);
  const unsure = match.confidence !== 'high';
  const node = useRef<View>(null);

  // Re-measured on every layout: the list reflows as quantities change, and
  // rows above this one can disappear.
  const measure = useCallback(() => {
    const id = match.productId;
    if (!id) return;
    node.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) onMeasure(id, { x, y, width, height });
    });
  }, [match.productId, onMeasure]);

  return (
    <View
      ref={node}
      collapsable={false}
      onLayout={measure}
      style={[s.item, !matched && s.itemUnmatched]}
    >
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

/** The size a product card sends, so both flights read as the same thing. */
const FLIGHT_SIZE = 56;

/**
 * How long the matched items stay on screen before they fly.
 *
 * Long enough to read two or three of them and long enough for their rows to
 * lay out and report where they are; short enough that it reads as the app
 * getting on with it rather than as a screen waiting to be tapped.
 */
const HANDOVER_DELAY_MS = 900;

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
  handing: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: grocery.pale,
  },
  handingText: { fontSize: 14, fontWeight: '800', color: grocery.blue },
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
