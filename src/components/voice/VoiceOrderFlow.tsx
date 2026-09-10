import { useCallback, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useReducedMotion } from 'react-native-reanimated';
import VoiceOrderSheet, {
  type ConfirmedVoiceItem,
  type ConfirmedVoiceOrder,
} from './VoiceOrderSheet';
import {
  FLIGHT_DURATION,
  FLIGHT_STAGGER,
  useCartFlight,
  type FlightRequest,
} from '../home/cartFlight';
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
 *   each item flies          spaced, so three reads as three
 *   the cart takes them      counting up as they leave
 *   checkout arrives         once the last one has landed
 *
 * Nothing is launched before the sheet is gone. A Modal is its own window
 * stacked above the flight layer, so an item sent while it is up travels behind
 * it and arrives from nowhere.
 *
 * And there are exactly two JS timers in the whole handover, not one per item.
 * That is the fix for a handover that stuttered: a chain of `setTimeout`s fired
 * a cart update between each departure and each landing, so React re-rendered
 * Home in the middle of every flight it was drawing. The quantities go in as one
 * batch, the flights go out as one salvo spaced on the UI thread, and nothing
 * touches the JS thread again until checkout.
 */

/** Long enough for the modal's slide-out; the flights start on an empty screen. */
export const SHEET_DISMISS_MS = 320;

/**
 * The gap between departures.
 *
 * Simultaneous flights read as one blurred movement and make the cart's
 * reaction fire three times over itself. Shared with taps from a product card,
 * so a spoken item and a tapped one move at the same rhythm.
 */
export const STAGGER_MS = FLIGHT_STAGGER;

/** A beat after the last arrival, so checkout does not cut off the landing. */
export const SETTLE_MS = 200;

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function VoiceOrderFlow({ visible, onClose }: Props) {
  const { flySalvo } = useCartFlight();
  const { addMany } = useCart();
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

      // Every item that has somewhere to fly from and something to draw. The
      // rest still reach the cart; they just do it without the flourish.
      const salvo: FlightRequest[] = [];
      for (const item of items) {
        const art = artFor(item.productId);
        if (item.origin && art !== undefined) {
          salvo.push({ ...item.origin, art });
        }
      }

      after(start, () => {
        // The count goes up with the departure rather than the arrival: a cart
        // that waits half a second for an animation reads as broken. One update
        // for the whole order, so the screen the flights are drawn on is not
        // re-rendered between them.
        addMany(
          items.map(item => ({ id: item.productId, quantity: item.quantity })),
        );
        if (salvo.length) flySalvo(salvo, stagger);
      });

      const lastLanding =
        start +
        (salvo.length ? salvo.length - 1 : 0) * stagger +
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
    [onClose, addMany, flySalvo, reduced, navigation],
  );

  return (
    <VoiceOrderSheet visible={visible} onClose={onClose} onConfirm={handoff} />
  );
}
