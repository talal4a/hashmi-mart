import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import ProduceArt from './ProduceArt';

/**
 * The item that flies from a product card into the cart.
 *
 * Two things make this read as one continuous event rather than as an
 * animation playing near a button.
 *
 * The destination is measured, never assumed. `CartTab` reports where its
 * basket opening actually is in window coordinates, and the flight ends there.
 * A hard-coded "bottom centre" lands on the label, or on the wheels, or beside
 * the bar entirely on a tablet — and it silently stops being right the moment
 * anything above it resizes.
 *
 * The item disappears *into* the opening rather than at it. Over the last fifth
 * of the trip it shrinks and fades while the cart tilts back to meet it, so the
 * last frame the eye catches is a small object at the mouth of the basket. Cut
 * it at full size and the illusion is of something vanishing in front of the
 * cart.
 *
 * The cart count is not routed through here. It updates the moment the button
 * is pressed, because a stepper that waits half a second for an animation is a
 * stepper that feels broken; what lands with the item is the cart's reaction,
 * not the number.
 */

/** Window coordinates of the basket opening, as measured by the cart. */
export type CartTarget = { x: number; y: number };

type FlightRequest = {
  /** Window coordinates and size of the artwork being sent. */
  x: number;
  y: number;
  size: number;
  /** Which produce illustration to draw in flight. */
  art: number;
};

type CartFlightValue = {
  /** Called by the cart once it knows where its basket opening is. */
  setTarget: (target: CartTarget | null) => void;
  /** Sends an item. A no-op when the cart has not reported a target yet. */
  fly: (request: FlightRequest) => void;
  /**
   * Ticks once per arrival. The cart watches it and plays its receive spring;
   * a counter rather than a boolean so two arrivals in a row both register.
   */
  arrivals: SharedValue<number>;
};

const CartFlightContext = createContext<CartFlightValue | null>(null);

export function useCartFlight(): CartFlightValue {
  const value = useContext(CartFlightContext);
  if (!value) {
    // A product card outside the provider should not crash the screen; it just
    // adds to the cart without the flourish.
    return NO_FLIGHT;
  }
  return value;
}

const NO_FLIGHT: CartFlightValue = {
  setTarget: () => {},
  fly: () => {},
  arrivals: { value: 0 } as SharedValue<number>,
};

/** Long enough to read as travel, short enough not to delay the next tap. */
const DURATION = 460;

/**
 * Exported so a caller that sends several items knows when the last one has
 * landed. Voice order waits for it before moving on to checkout.
 */
export const FLIGHT_DURATION = DURATION;

type Flight = FlightRequest & { id: number; to: CartTarget };

export function CartFlightProvider({ children }: { children: ReactNode }) {
  const target = useRef<CartTarget | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const nextId = useRef(0);
  const arrivals = useSharedValue(0);
  const reduced = useReducedMotion();

  const setTarget = useCallback((next: CartTarget | null) => {
    target.current = next;
  }, []);

  const remove = useCallback((id: number) => {
    setFlights(current => current.filter(flight => flight.id !== id));
  }, []);

  const fly = useCallback(
    (request: FlightRequest) => {
      const to = target.current;
      // Under Reduce Motion the cart still acknowledges the item; it just does
      // not watch it travel.
      if (!to || reduced) {
        arrivals.value += 1;
        return;
      }
      nextId.current += 1;
      setFlights(current => [
        ...current,
        { ...request, id: nextId.current, to },
      ]);
    },
    [reduced, arrivals],
  );

  const value = useMemo(
    () => ({ setTarget, fly, arrivals }),
    [setTarget, fly, arrivals],
  );

  return (
    <CartFlightContext.Provider value={value}>
      {children}
      {/* Above everything, including the bar, so the item is still visible as
          it reaches the basket. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {flights.map(flight => (
          <FlyingItem
            key={flight.id}
            flight={flight}
            arrivals={arrivals}
            onDone={remove}
          />
        ))}
      </View>
    </CartFlightContext.Provider>
  );
}

function FlyingItem({
  flight,
  arrivals,
  onDone,
}: {
  flight: Flight;
  arrivals: SharedValue<number>;
  onDone: (id: number) => void;
}) {
  const progress = useSharedValue(0);
  const started = useRef(false);

  if (!started.current) {
    started.current = true;
    progress.value = withTiming(
      1,
      // Eased out rather than linear: an item that decelerates into the basket
      // looks thrown, one that arrives at constant speed looks dragged.
      { duration: DURATION, easing: Easing.bezier(0.35, 0, 0.25, 1) },
      finished => {
        if (!finished) return;
        arrivals.value += 1;
        runOnJS(onDone)(flight.id);
      },
    );
  }

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const u = 1 - t;

    // A quadratic arc with the control point lifted above the midpoint, so the
    // item rises out of the card before falling into the cart. A straight line
    // between two points near the bottom of the screen reads as a slide.
    const cx = (flight.x + flight.to.x) / 2;
    const cy = Math.min(flight.y, flight.to.y) - 90;

    const x = u * u * flight.x + 2 * u * t * cx + t * t * flight.to.x;
    const y = u * u * flight.y + 2 * u * t * cy + t * t * flight.to.y;

    // The last fifth is the landing: it shrinks into the opening and fades, so
    // the final frame is a small object at the basket's mouth.
    const land = t < 0.8 ? 0 : (t - 0.8) / 0.2;
    return {
      transform: [
        { translateX: x - flight.size / 2 },
        { translateY: y - flight.size / 2 },
        { scale: (1 - 0.28 * t) * (1 - 0.55 * land) },
        { rotate: `${t * 26}deg` },
      ],
      opacity: 1 - land * 0.85,
    };
  });

  return (
    <Animated.View style={[s.item, style]}>
      <ProduceArt
        index={flight.art}
        size={flight.size}
        radius={flight.size / 4}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  item: { position: 'absolute', top: 0, left: 0 },
});
