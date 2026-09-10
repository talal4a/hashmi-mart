import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * The item that flies from a product card into the cart.
 *
 * Three things make this read as one continuous event rather than as an
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
 * And no frame of it costs a React render. That was the bug: flights lived in
 * this provider's `useState`, so launching one re-rendered every child of the
 * provider — on Home, the entire page and every product card in it — and so did
 * each landing. A voice order sending three items re-rendered the screen six
 * times inside a second and a half, which is exactly the window the animation
 * had to be smooth in. What the customer saw was the sheet close, a stutter,
 * and items arriving late or not visibly at all.
 *
 * So the flyers are a fixed pool, mounted once, parked invisible, and driven
 * entirely from shared values. Launching writes numbers on the UI thread. The
 * provider's value is created once and never changes, so a flight cannot
 * re-render a consumer either.
 *
 * The cart count is not routed through here. It updates the moment the button
 * is pressed, because a stepper that waits half a second for an animation is a
 * stepper that feels broken; what lands with the item is the cart's reaction,
 * not the number.
 */

/** Window coordinates of the basket opening, as measured by the cart. */
export type CartTarget = { x: number; y: number };

export type FlightRequest = {
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
   * Sends several items at once, spaced by `stagger` milliseconds.
   *
   * The spacing is applied on the UI thread rather than by a chain of
   * `setTimeout`s, which is the difference between one JS tick for a whole
   * spoken order and one per item landing in the middle of the animation.
   */
  flySalvo: (requests: FlightRequest[], stagger?: number) => void;
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
  flySalvo: () => {},
  arrivals: { value: 0 } as SharedValue<number>,
};

/**
 * The longest a single flight can take.
 *
 * Also the number a caller schedules against, so it is a ceiling rather than a
 * typical: the real duration scales with how far the item has to travel, and a
 * card already near the bar arrives sooner than this. Something waiting for the
 * last landing may wait a little long; it can never cut one off.
 */
const MAX_DURATION = 460;
const MIN_DURATION = 380;

/** Exported so a caller that sends several items knows when the last one lands. */
export const FLIGHT_DURATION = MAX_DURATION;

/** Default spacing between departures in a salvo. */
export const FLIGHT_STAGGER = 140;

/**
 * How many items can be in the air at once.
 *
 * A voice order is the busiest case and tops out at a handful; eight parked
 * views cost nothing and mean a launch never has to mount anything.
 */
const POOL = 8;

/** Eased out rather than linear: an item that decelerates into the basket looks
 *  thrown, one that arrives at constant speed looks dragged. */
const TRAVEL = Easing.bezier(0.32, 0, 0.2, 1);

/**
 * The size every flyer is actually laid out at.
 *
 * One number for all of them, so nothing about a flight touches layout: the
 * size a caller asks for arrives as a scale factor instead. Large enough that
 * scaling up for an unusually big source still has pixels to work with.
 */
const BASE = 64;

/** Everything one parked flyer needs, all of it readable from the UI thread. */
type Slot = {
  /** 0 → parked and invisible, 1 → in the air. */
  live: SharedValue<number>;
  progress: SharedValue<number>;
  fromX: SharedValue<number>;
  fromY: SharedValue<number>;
  toX: SharedValue<number>;
  toY: SharedValue<number>;
  size: SharedValue<number>;
  art: SharedValue<number>;
  /** How high above the straight line the arc bows. */
  lift: SharedValue<number>;
  /** Degrees of tumble over the whole trip; signed by travel direction. */
  spin: SharedValue<number>;
};

export function CartFlightProvider({ children }: { children: ReactNode }) {
  const target = useRef<CartTarget | null>(null);
  const arrivals = useSharedValue(0);

  const reduced = useReducedMotion();
  // Read at launch time from the UI thread, so a flight in progress and the
  // next launch always agree about it.
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const slots = useRef<Slot[]>([]);
  const cursor = useRef(0);

  const register = useCallback((index: number, slot: Slot) => {
    slots.current[index] = slot;
  }, []);

  const setTarget = useCallback((next: CartTarget | null) => {
    target.current = next;
  }, []);

  /**
   * Sends a batch, already spaced.
   *
   * The spacing is `withDelay` on the UI thread rather than a chain of
   * `setTimeout`s, which is the difference between one JS tick for a whole
   * spoken order and one per item, fired into the middle of the animation by a
   * timer that has already drifted.
   *
   * `fly` is this with a batch of one. A single tap and a spoken order should
   * not take two different code paths into the same animation.
   */
  const launch = useCallback(
    (requests: FlightRequest[], stagger: number) => {
      const to = target.current;
      if (!requests.length) return;

      // Under Reduce Motion the cart still acknowledges each item; it just does
      // not watch them travel. Same when nothing has reported a destination —
      // an unmeasured cart must cost the flourish, not the feedback.
      if (!to || reducedRef.current) {
        arrivals.value += requests.length;
        return;
      }

      requests.forEach((request, index) => {
        const slot = slots.current[cursor.current % POOL];
        cursor.current += 1;
        if (!slot) return;

        const dx = to.x - request.x;
        const dy = to.y - request.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        slot.fromX.value = request.x;
        slot.fromY.value = request.y;
        slot.toX.value = to.x;
        slot.toY.value = to.y;
        slot.size.value = request.size;
        slot.art.value = request.art;
        // The bow of the arc, proportional to the trip. A fixed lift is a
        // gentle curve across the screen and a loop-the-loop up close.
        slot.lift.value = Math.min(210, Math.max(74, distance * 0.42));
        // Tumbles away from the direction of travel, so the item looks thrown
        // by the card rather than spun on the spot.
        slot.spin.value = (dx >= 0 ? 1 : -1) * (16 + Math.min(16, distance / 46));
        // Cleared before, not only set after: a slot being reused while its
        // last flight is still in the air would otherwise stay visible through
        // its stagger delay, parked at the new origin, as an item that appears
        // out of nowhere and waits.
        slot.progress.value = 0;
        slot.live.value = 0;

        const delay = index * stagger;
        // Near the bar already: less time in the air, or the flight reads as
        // hesitating. Right across the screen: the full arc.
        const duration = Math.round(
          Math.min(
            MAX_DURATION,
            Math.max(MIN_DURATION, MIN_DURATION + distance * 0.14),
          ),
        );

        // Parked until its turn. A flyer sitting visible on the origin card
        // through its stagger delay is an item that looks stuck.
        slot.live.value = withDelay(delay, withTiming(1, { duration: 0 }));
        slot.progress.value = withDelay(
          delay,
          withTiming(1, { duration, easing: TRAVEL }, finished => {
            'worklet';
            if (!finished) return;
            slot.live.value = 0;
            // Bumped here rather than through `runOnJS`, so the cart's
            // reaction is frame-accurate with the item disappearing into it.
            arrivals.value += 1;
          }),
        );
      });
    },
    [arrivals],
  );

  const fly = useCallback(
    (request: FlightRequest) => launch([request], 0),
    [launch],
  );

  const flySalvo = useCallback(
    (requests: FlightRequest[], stagger: number = FLIGHT_STAGGER) =>
      launch(requests, stagger),
    [launch],
  );

  // Stable for the life of the screen. A consumer of this context must never
  // re-render because something flew.
  const value = useMemo(
    () => ({ setTarget, fly, flySalvo, arrivals }),
    [setTarget, fly, flySalvo, arrivals],
  );

  return (
    <CartFlightContext.Provider value={value}>
      {children}
      {/* Above everything, including the bar, so the item is still visible as
          it reaches the basket. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {POOL_INDICES.map(index => (
          <Flyer key={index} index={index} onRegister={register} />
        ))}
      </View>
    </CartFlightContext.Provider>
  );
}

const POOL_INDICES = Array.from({ length: POOL }, (_, index) => index);

const SHEET = require('../../assets/images/home/produce-sheet.png');

/**
 * One parked flyer.
 *
 * Mounted once and never unmounted. Everything about what it draws — which
 * illustration, how big, where — is a shared value, so a launch is a write on
 * the UI thread and React is not involved in any of it.
 */
function Flyer({
  index,
  onRegister,
}: {
  index: number;
  onRegister: (index: number, slot: Slot) => void;
}) {
  const live = useSharedValue(0);
  const progress = useSharedValue(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const toX = useSharedValue(0);
  const toY = useSharedValue(0);
  const size = useSharedValue(56);
  const art = useSharedValue(0);
  const lift = useSharedValue(120);
  const spin = useSharedValue(24);

  const slot = useMemo(
    () => ({ live, progress, fromX, fromY, toX, toY, size, art, lift, spin }),
    [live, progress, fromX, fromY, toX, toY, size, art, lift, spin],
  );

  useEffect(() => onRegister(index, slot), [index, onRegister, slot]);

  /**
   * The path is a cubic with both handles pulled straight up.
   *
   * Which is what makes it look thrown: the item leaves the card vertically
   * and drops into the basket vertically, instead of sliding along a shallow
   * curve between two points near the bottom of the screen.
   *
   * Note what is *not* animated here. The flyer's box is a fixed BASE square
   * and the illustration inside it is positioned by translation, so the
   * requested size arrives as a scale factor. Every property that changes
   * during a flight is a transform or an opacity — nothing on this path asks
   * for a layout pass, which is the difference between three items in the air
   * costing nothing and costing the frame budget of whatever is behind them.
   */
  const box = useAnimatedStyle(() => {
    const t = progress.value;
    const u = 1 - t;
    const s = size.value;

    const x0 = fromX.value;
    const y0 = fromY.value;
    const x3 = toX.value;
    const y3 = toY.value;
    const x1 = x0 + (x3 - x0) * 0.16;
    const y1 = y0 - lift.value * 0.95;
    const x2 = x3 - (x3 - x0) * 0.1;
    const y2 = y3 - lift.value * 1.15;

    const uu = u * u;
    const tt = t * t;
    const x = uu * u * x0 + 3 * uu * t * x1 + 3 * u * tt * x2 + tt * t * x3;
    const y = uu * u * y0 + 3 * uu * t * y1 + 3 * u * tt * y2 + tt * t * y3;

    // Three beats, in the order the eye reads them: a snap out of the card,
    // the cruise, and the drop into the mouth of the basket.
    const takeoff = t < 0.16 ? t / 0.16 : 1;
    const land = t < 0.8 ? 0 : (t - 0.8) / 0.2;
    const pop = 0.78 + 0.3 * takeoff - 0.08 * takeoff * takeoff;
    const scale = (s / BASE) * pop * (1 - 0.2 * t) * (1 - 0.62 * land * land);

    // Eases out with the travel, so the tumble stops as the item arrives
    // rather than still turning when it vanishes.
    const turn = spin.value * (1 - u * u * u);

    return {
      opacity: live.value * (1 - land * land * 0.9),
      transform: [
        // The box is centred on the path by its own half-size, then scaled
        // about that point — so the drawn size follows the scale rather than
        // the layout.
        { translateX: x - BASE / 2 },
        { translateY: y - BASE / 2 },
        { scale },
        { rotate: `${turn}deg` },
      ],
    };
  });

  /**
   * A soft bloom that blows out on takeoff and again as the item is swallowed.
   *
   * It is what keeps a small square legible while it is moving fast over a
   * busy page — the eye tracks the halo, not the edges.
   */
  const glow = useAnimatedStyle(() => {
    const t = progress.value;
    const takeoff = t < 0.16 ? t / 0.16 : 0;
    const land = t < 0.78 ? 0 : (t - 0.78) / 0.22;
    return {
      opacity: live.value * (0.42 * (1 - takeoff) + 0.5 * land),
      transform: [{ scale: 1.16 + 0.5 * land }],
    };
  });

  /**
   * The illustration is one cell of a 3×2 contact sheet.
   *
   * Slid into place rather than offset with `left`/`top`: the sheet is a fixed
   * size, so picking a cell is a translation and costs no layout.
   */
  const cell = useAnimatedStyle(() => {
    const i = Math.round(art.value);
    return {
      transform: [
        { translateX: -(i % 3) * BASE },
        { translateY: -Math.floor(i / 3) * BASE },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[st.flyer, box]}>
      <Animated.View pointerEvents="none" style={[st.glow, glow]} />
      <View style={st.clip}>
        <Animated.Image
          source={SHEET}
          accessibilityIgnoresInvertColors
          resizeMode="stretch"
          style={[st.cell, cell]}
        />
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  flyer: { position: 'absolute', top: 0, left: 0, width: BASE, height: BASE },
  clip: {
    width: BASE,
    height: BASE,
    borderRadius: BASE / 4,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  cell: { position: 'absolute', width: BASE * 3, height: BASE * 2 },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: '#8ADCFA',
  },
});
