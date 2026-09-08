import { useCallback, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useReducedMotion } from 'react-native-reanimated';
import VoiceOrderSheet, {
  type ConfirmedVoiceItem,
  type ConfirmedVoiceOrder,
} from './VoiceOrderSheet';
import { FLIGHT_DURATION, useCartFlight } from '../home/cartFlight';
import { artFor, useCart } from '../../state/cart';
import type { RootStackParamList } from '../../navigation/RootNavigator';

/**
 * What happens between "yes, that's my order" and paying for it.
 *
 * Confirming used to add the quantities and close the sheet, and that was the
 * whole of it: the number on the cart went up and nothing moved, on a screen
 * whose entire vocabulary is items flying into a basket. Spoken items were the
 * one way into the cart that did not look like going into the cart.
 *
 * So this component owns the handover, and it has to be a component rather than
 * a callback in Home because both halves of it are context — the flight layer
 * and the cart — and Home renders the provider for the first.
 *
 * The order of events is the point:
 *
 *   the sheet dismisses      the items are still where they were
 *   each item flies          160ms apart, so three reads as three
 *   the cart takes them      counting up as each one leaves
 *   checkout arrives         once the last one has landed
 *
 * Nothing is launched before the sheet is gone. A Modal is its own window
 * stacked above the flight layer, so an item sent while it is up travels behind
 * it and arrives from nowhere.
 */

/** Long enough for the modal's slide-out; the flights start on an empty screen. */
const SHEET_DISMISS_MS = 320;

/**
 * The gap between departures.
 *
 * Simultaneous flights read as one blurred movement and make the cart's
 * reaction fire three times over itself. 160ms is enough to see each one land.
 */
const STAGGER_MS = 160;

/** A beat after the last arrival, so checkout does not cut off the landing. */
const SETTLE_MS = 220;

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function VoiceOrderFlow({ visible, onClose }: Props) {
  const { fly } = useCartFlight();
  const { add } = useCart();
  const reduced = useReducedMotion();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // A confirmed order schedules work for the next second and a half. Leaving
  // the screen inside that window must not leave timers running against an
  // unmounted tree.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  const handoff = useCallback(
    (items: ConfirmedVoiceItem[], order: ConfirmedVoiceOrder) => {
      onClose();
      if (!items.length) return;

      const after = (ms: number, run: () => void) => {
        timers.current.push(setTimeout(run, ms));
      };

      const stagger = reduced ? 0 : STAGGER_MS;
      const start = reduced ? 0 : SHEET_DISMISS_MS;

      items.forEach((item, index) => {
        after(start + index * stagger, () => {
          const art = artFor(item.productId);
          // The count goes up now, with the departure rather than the arrival:
          // a cart that waits half a second for an animation reads as broken.
          add(item.productId, item.quantity);
          if (item.origin && art !== undefined) {
            fly({ ...item.origin, art });
          }
        });
      });

      const lastLanding =
        start +
        (items.length - 1) * stagger +
        (reduced ? 0 : FLIGHT_DURATION) +
        SETTLE_MS;

      after(lastLanding, () =>
        navigation.navigate('Checkout', {
          source: 'voice',
          transcript: order.transcript,
          outOfStock: order.outOfStock.length ? order.outOfStock : undefined,
          unclear: order.unclear.length ? order.unclear : undefined,
          recording: order.recording ?? undefined,
        }),
      );
    },
    [onClose, add, fly, reduced, navigation],
  );

  return (
    <VoiceOrderSheet visible={visible} onClose={onClose} onConfirm={handoff} />
  );
}
