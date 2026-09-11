import { useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LayoutRectangle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Mic, X } from 'lucide-react-native';
import PressableScale from '../ui/PressableScale';
import { grocery } from '../home/groceryTheme';
import useVoiceRecorder, { formatDuration } from '../../hooks/useVoiceRecorder';
import {
  useVoiceOrderSession,
  type VoiceOrderSession,
} from '../../state/voiceOrderSession';
import AnimatedMic from './AnimatedMic';
import VoiceWaveform from './VoiceWaveform';
import {
  VoiceHandoff,
  VoiceItemRow,
  VoicePulse,
  VoiceSteps,
  VoiceTrouble,
  type TroubleKind,
} from './VoiceReview';
import { tapHandoff, tapRecordStart, tapSend } from './haptics';

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
  /**
   * The two ways an item can fail to reach the cart, kept apart.
   *
   * They are not the same news. "We don't stock eggs" is about our shelf and
   * repeating the order will not change it; "we couldn't make that out" is
   * about the recording and saying it again is exactly the fix. Told as one
   * message they both read as the app being broken.
   */
  outOfStock: string[];
  unclear: string[];
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
  // The pipeline lives above the navigator, not in this component. Everything
  // below can unmount mid-order without touching it.
  const order = useVoiceOrderSession();

  /**
   * Opening the sheet starts listening.
   *
   * Tapping a microphone and then having to tap another one is a step nobody
   * wants. Opening also abandons whatever the last attempt produced — that is
   * an explicit new recording, which is the one thing that legitimately
   * supersedes an order in flight.
   */
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    order.discard();
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

  /**
   * Puts the sheet away.
   *
   * It does not touch the order. Closing a piece of UI is not a decision about
   * the groceries — and treating it as one is exactly how a recording that was
   * safely on disk ended up producing nothing: the close handler called
   * `reset()` on the pipeline, so tapping Stop and then X in the same second
   * cancelled an order the customer had already finished placing.
   *
   * A recording still running is a different matter: there is nothing to keep,
   * so it is cancelled and the file goes with it.
   */
  const close = useCallback(() => {
    cancelHandover();
    if (recorder.recording) {
      void recorder.cancel();
      order.discard();
    }
    onClose();
  }, [cancelHandover, recorder, order, onClose]);

  /**
   * Says it again.
   *
   * The one repair that actually helps when nothing was understood — and it
   * was not offered at all: the only way back to the microphone was to close
   * the sheet and start over, which looks like being told no.
   */
  const retake = useCallback(async () => {
    cancelHandover();
    order.discard();
    const started = await recorder.start();
    if (started) tapRecordStart();
  }, [cancelHandover, order, recorder]);

  /**
   * Stop.
   *
   * The hand-off happens before the sheet is allowed to go anywhere: the file
   * is finished, ownership passes to the session above the navigator, and only
   * then is anything free to unmount. `accept` is synchronous for that reason —
   * there is no await between handing the recording over and being safe.
   */
  const finish = useCallback(async () => {
    const result = await recorder.stop();
    if (!result) return;
    tapSend();
    order.accept(result);
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
    const unmatched = order.matches.filter(match => !match.productId);
    const outOfStock = [
      ...new Set(
        unmatched
          .map(match => match.unstocked)
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    const unclear = unmatched
      .filter(match => !match.unstocked)
      .map(match => match.query);
    const recording = order.recording
      ? { uri: order.recording.uri, durationMs: order.recording.durationMs }
      : null;
    // Note the order: the sheet's own recorder is released, but the file it
    // wrote is not touched. Checkout plays it back.
    void recorder.cancel();
    order.discard();
    onConfirm(items, { transcript, outOfStock, unclear, recording });
  }, [order, recorder, onConfirm, cancelHandover]);

  /**
   * Adds one thing we do sell, when nothing that was said matched.
   *
   * Goes out through the same handover as a spoken order rather than round
   * some second path into the cart: the chip measures itself, so the item
   * flies from where it was tapped and checkout opens behind it exactly as it
   * would have if we had understood the sentence. A dead end that quietly
   * behaves differently from the happy path is a second thing to maintain and
   * a second thing to get wrong.
   */
  const confirmPicked = useCallback(
    (productId: string) => {
      cancelHandover();
      tapHandoff();
      const frame = rows.current.get(productId);
      const transcript = order.transcript || null;
      const recording = order.recording
        ? { uri: order.recording.uri, durationMs: order.recording.durationMs }
        : null;
      void recorder.cancel();
      order.discard();
      onConfirm(
        [
          {
            productId,
            quantity: 1,
            origin: frame
              ? {
                  size: FLIGHT_SIZE,
                  x: frame.x + frame.width / 2 - FLIGHT_SIZE / 2,
                  y: frame.y + frame.height / 2 - FLIGHT_SIZE / 2,
                }
              : undefined,
          },
        ],
        // Nothing was out of stock or unclear from the app's point of view:
        // the customer has just told us what they wanted by pointing at it.
        { transcript, outOfStock: [], unclear: [], recording },
      );
    },
    [cancelHandover, order, recorder, onConfirm],
  );

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
    if (order.stage !== 'ready' || order.addable.length === 0) return;
    if (handover.current) return;
    handover.current = setTimeout(confirmAll, HANDOVER_DELAY_MS);
  }, [order.stage, order.addable.length, confirmAll]);

  // A sheet reopened after a handover must not still be holding the old one.
  useEffect(() => {
    if (!visible) cancelHandover();
  }, [visible, cancelHandover]);

  const enter = reduced ? undefined : FadeInDown.duration(240);

  /**
   * Which of the four nodes is live, and whether it is stuck there.
   *
   * Derived from the session's stage rather than tracked, because the stage is
   * already the truth: a rail with its own state is a rail that disagrees with
   * the screen it is describing the moment a request fails out of order.
   */
  const handing = order.stage === 'ready' && order.addable.length > 0;
  const stuck = order.stage === 'empty' || order.stage === 'error';
  const step = recorder.recording
    ? 0
    : order.stage === 'finalizing' || order.stage === 'transcribing'
      ? 1
      : handing
        ? 3
        : 2;

  const working =
    order.stage === 'finalizing' ||
    order.stage === 'transcribing' ||
    order.stage === 'understanding' ||
    order.stage === 'matching';

  const workingLabel =
    order.stage === 'finalizing'
      ? 'Finishing your recording…'
      : order.stage === 'transcribing'
        ? 'Listening to your order…'
        : order.stage === 'understanding'
          ? 'Understanding your order…'
          : 'Finding your groceries…';

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

          {/* Where we are in the pipeline, on every screen that is part of it.
              It is the one thing that makes a four-second transcription read
              as a stage rather than as a stall — and it stays put between
              stages, so the sheet does not appear to rebuild itself each time
              the wait changes its name. */}
          <VoiceSteps at={step} failed={stuck} />

          {recorder.recording ? (
            <RecordingView
              levels={recorder.levels}
              durationMs={recorder.durationMs}
              onCancel={close}
              onDone={finish}
            />
          ) : working ? (
            <VoicePulse label={workingLabel} />
          ) : (
            <Review
              order={order}
              handing={handing}
              onHandNow={confirmAll}
              onPick={confirmPicked}
              onRetake={retake}
              onRetry={order.retry}
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

function Review({
  order,
  handing,
  onHandNow,
  onPick,
  onRetake,
  onRetry,
  onSetQuantity,
  onMeasureRow,
}: {
  order: VoiceOrderSession;
  /** True while the matched items are counting down to their flight. */
  handing: boolean;
  onHandNow: () => void;
  onPick: (productId: string) => void;
  onRetake: () => void;
  /** Re-sends the audio we already have. Never asks for another recording. */
  onRetry: () => void;
  onSetQuantity: (index: number, quantity: number) => void;
  onMeasureRow: (productId: string, frame: LayoutRectangle) => void;
}) {
  const nothing = order.addable.length === 0;
  return (
    <View style={s.body}>
      {order.transcript ? (
        <View style={s.heard}>
          <View style={s.heardHead}>
            <Mic size={11} color={grocery.blue} strokeWidth={2.6} />
            <Text style={s.heardLabel}>You said</Text>
          </View>
          <Text style={s.heardText}>{order.transcript}</Text>
        </View>
      ) : null}

      {nothing ? (
        <Trouble order={order} onPick={onPick} onMeasure={onMeasureRow} />
      ) : null}

      {/* The rows are the matched order. With nothing matched they were a list
          of the same words the state above already shows struck through — the
          same news twice, and the second telling in the shape of a cart. */}
      {!nothing && order.matches.length > 0 ? (
        <ScrollView
          style={s.items}
          contentContainerStyle={s.itemsInner}
          showsVerticalScrollIndicator={false}
        >
          {order.matches.map((match, index) => (
            <VoiceItemRow
              key={`${match.query}-${index}`}
              match={match}
              index={index}
              launching={handing}
              onSetQuantity={next => onSetQuantity(index, next)}
              onMeasure={onMeasureRow}
            />
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
        {handing ? (
          <VoiceHandoff
            count={order.addable.length}
            durationMs={HANDOVER_DELAY_MS}
            onSkip={onHandNow}
          />
        ) : (
          <>
            {/* Speaking again is the repair that actually works, so it is the
                one that looks like the answer.

                There is deliberately no "send this to the store" beside it any
                more. It ended a voice order on a promise of a phone call,
                which is not what anybody asks for by speaking into a grocery
                app — and it was offered for failures the customer could fix in
                four seconds by saying two words again. */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Speak again"
              onPress={onRetake}
              scaleTo={0.96}
              style={s.primary}
            >
              <Mic size={16} color={grocery.white} strokeWidth={2.4} />
              <Text style={s.primaryText}>Speak again</Text>
            </PressableScale>
            {/* Only when the failure was ours. The recording is still here, so
                this costs the customer nothing but a moment — asking them to
                say it all again because our upstream blinked is the rudest
                thing this screen could do. */}
            {order.stage === 'error' && order.recording ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Try the same recording again"
                onPress={onRetry}
                scaleTo={0.96}
                style={s.ghostWide}
              >
                <Text style={s.ghostText}>Try again</Text>
              </PressableScale>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

/**
 * Which dead end this is, and what the customer actually said.
 *
 * The four reasons are told apart here rather than in the state below, because
 * only this file knows the shape of a match: `VoiceTrouble` is handed a kind
 * and a list of words and has no opinion about where either came from.
 *
 * The distinctions matter because they imply different repairs. Silence and a
 * misheard word are fixed by saying it again. An empty shelf is fixed by
 * nothing the customer can do — so that is the case that offers the shelf.
 * And a backend that fell over is ours to apologise for, in its own words.
 */
function Trouble({
  order,
  onPick,
  onMeasure,
}: {
  order: VoiceOrderSession;
  onPick: (productId: string) => void;
  onMeasure: (productId: string, frame: LayoutRectangle) => void;
}) {
  const unmatched = order.matches.filter(match => !match.productId);
  const outOfStock = [
    ...new Set(
      unmatched
        .map(match => match.unstocked)
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  let kind: TroubleKind;
  if (order.stage === 'error') kind = 'failed';
  else if (!order.transcript) kind = 'silent';
  // Everything we heard was a real thing we simply do not sell. Telling this
  // customer we did not catch them is the worse of the two mistakes: we caught
  // them perfectly.
  else if (outOfStock.length > 0 && outOfStock.length === unmatched.length)
    kind = 'unstocked';
  else kind = 'unmatched';

  // What was heard and could not be used, in the customer's own words. The
  // out-of-stock names first, because those are the ones we understood.
  const words = [
    ...outOfStock,
    ...unmatched.filter(match => !match.unstocked).map(match => match.query),
  ];

  return (
    <VoiceTrouble
      kind={kind}
      detail={order.error}
      words={words}
      onPick={onPick}
      onMeasure={onMeasure}
    />
  );
}

/** The size a product card sends, so both flights read as the same thing. */
const FLIGHT_SIZE = 56;

/**
 * How long the matched items stay on screen before they fly.
 *
 * Long enough to read two or three of them and long enough for their rows to
 * lay out and report where they are. It used to have to be short as well,
 * because nothing on screen said it would end — so it had to be over before it
 * could be mistaken for a hang. The bar under the items now draws itself down
 * through it and a tap goes straight through, which buys the extra beat that
 * makes an Urdu or Punjabi match actually checkable.
 */
const HANDOVER_DELAY_MS = 1000;

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
  items: { maxHeight: 258 },
  // Room for the shadow the rows cast, and for the tilt they take before they
  // fly; a tight container clips both.
  itemsInner: { gap: 9, paddingVertical: 3, paddingHorizontal: 2 },
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
    gap: 5,
  },
  heardHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heardLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: grocery.blue,
  },
  heardText: {
    fontSize: 14,
    lineHeight: 20,
    color: grocery.ink,
    writingDirection: 'auto',
  },


  actions: { gap: 8 },
  ghostWide: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FA',
  },
  row: { flexDirection: 'row', gap: 10 },
  primary: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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

  note: {
    fontSize: 11.5,
    lineHeight: 16,
    color: grocery.muted,
    textAlign: 'center',
    paddingTop: 10,
  },
});
