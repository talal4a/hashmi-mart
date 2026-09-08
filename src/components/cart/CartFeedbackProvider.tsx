import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { AccessibilityInfo, AppState, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import ProduceArt from '../home/ProduceArt';
import {
  flightEndpoints,
  FLIGHT_DURATION,
  FLIGHT_SIZE,
  MAX_CART_FLIGHTS,
  RECEIVE_AT,
  sampleFlight,
  type Point,
  type Rect,
} from './cartMotion';
import { receiveCart } from './useCartReaction';

type Flight = { id: number; art: number; start: Point; end: Point };
type Feedback = {
  basketRef: RefObject<View | null>;
  reaction: SharedValue<number>;
  badgeScale: SharedValue<number>;
  enabled: boolean;
  reduced: boolean;
  flyToCart: (art: number, source: RefObject<View | null>) => void;
  triggerCartReaction: () => void;
};
const Context = createContext<Feedback | null>(null);

export const useCartFeedback = () => useContext(Context);

export function cartHaptic() {
  if (AppState.currentState === 'active') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

function measure(view: View | null): Promise<Rect | null> {
  if (!view) return Promise.resolve(null);
  return new Promise(resolve => {
    // A disappearing native view can omit its callback. Release the bounded
    // flight slot instead of leaving feedback disabled until the next layout.
    const timeout = setTimeout(() => resolve(null), 250);
    const finish = (rect: Rect | null) => {
      clearTimeout(timeout);
      resolve(rect);
    };
    try {
      view.measureInWindow((x, y, width, height) =>
        finish({ x, y, width, height }),
      );
    } catch {
      finish(null);
    }
  });
}

/** Animation state only. Quantities belong exclusively to the cart store. */
export default function CartFeedbackProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const basketRef = useRef<View>(null);
  const overlayRef = useRef<View>(null);
  const reaction = useSharedValue(0);
  const badgeScale = useSharedValue(1);
  const initialReduced = useReducedMotion();
  const [reduced, setReduced] = useState(initialReduced);
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  const [flights, setFlights] = useState<Flight[]>([]);
  const epoch = useRef(0);
  const nextId = useRef(0);
  // Includes flights whose native measurement is still pending, so rapid taps
  // cannot allocate an unbounded queue before React has committed.
  const occupied = useRef(new Set<number>());
  const visible = enabled && appActive;
  const allowed = useRef(visible);
  allowed.current = visible;

  const clear = useCallback(() => {
    epoch.current += 1;
    occupied.current.clear();
    setFlights(previous => (previous.length ? [] : previous));
    cancelAnimation(reaction);
    cancelAnimation(badgeScale);
    reaction.value = 0;
    badgeScale.value = 1;
  }, [reaction, badgeScale]);

  useEffect(() => {
    let mounted = true;
    const refreshReduced = () => {
      void AccessibilityInfo.isReduceMotionEnabled()
        .then(value => {
          if (mounted) setReduced(value);
        })
        .catch(() => {});
    };
    refreshReduced();
    const motion = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );
    const app = AppState.addEventListener('change', state => {
      allowed.current = enabled && state === 'active';
      if (state !== 'active') clear();
      else refreshReduced();
      setAppActive(state === 'active');
    });
    return () => {
      mounted = false;
      motion.remove();
      app.remove();
    };
  }, [clear, enabled]);

  useEffect(() => {
    clear();
  }, [visible, reduced, clear]);
  useEffect(
    () => () => {
      allowed.current = false;
      epoch.current += 1;
      occupied.current.clear();
      cancelAnimation(reaction);
      cancelAnimation(badgeScale);
    },
    [reaction, badgeScale],
  );

  const triggerCartReaction = useCallback(() => {
    if (!allowed.current) return;
    receiveCart(reaction, badgeScale, reduced);
    cartHaptic();
  }, [reaction, badgeScale, reduced]);

  const flyToCart = useCallback(
    async (art: number, source: RefObject<View | null>) => {
      if (!allowed.current) return;
      if (reduced) {
        triggerCartReaction();
        return;
      }
      // Additional taps still update business state immediately; existing flights
      // deliver their feedback. We never replace/restart an image midair.
      if (occupied.current.size >= MAX_CART_FLIGHTS) return;
      const id = ++nextId.current;
      const generation = epoch.current;
      occupied.current.add(id);
      const [origin, basket, overlay] = await Promise.all([
        measure(source.current),
        measure(basketRef.current),
        measure(overlayRef.current),
      ]);
      if (generation !== epoch.current || !allowed.current) return;
      const points =
        origin && basket && overlay
          ? flightEndpoints(origin, basket, overlay)
          : null;
      if (!points) {
        occupied.current.delete(id);
        triggerCartReaction();
        return;
      }
      setFlights(previous => [...previous, { id, art, ...points }]);
    },
    [reduced, triggerCartReaction],
  );

  const finish = useCallback((id: number) => {
    // A completion already queued on JS must not vibrate after cancellation.
    if (!occupied.current.delete(id)) return;
    setFlights(previous => previous.filter(flight => flight.id !== id));
    if (allowed.current) cartHaptic();
  }, []);
  const value = useMemo(
    () => ({
      basketRef,
      reaction,
      badgeScale,
      enabled: visible,
      reduced,
      flyToCart,
      triggerCartReaction,
    }),
    [reaction, badgeScale, visible, reduced, flyToCart, triggerCartReaction],
  );

  return (
    <Context.Provider value={value}>
      {children}
      <View
        ref={overlayRef}
        collapsable={false}
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={clear}
        style={StyleSheet.absoluteFill}
      >
        {flights.map(flight => (
          <ProductFlight
            key={flight.id}
            flight={flight}
            reaction={reaction}
            badgeScale={badgeScale}
            finish={finish}
          />
        ))}
      </View>
    </Context.Provider>
  );
}

function ProductFlight({
  flight,
  reaction,
  badgeScale,
  finish,
}: {
  flight: Flight;
  reaction: SharedValue<number>;
  badgeScale: SharedValue<number>;
  finish: (id: number) => void;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: FLIGHT_DURATION, easing: Easing.linear },
      done => {
        if (done) scheduleOnRN(finish, flight.id);
      },
    );
    return () => cancelAnimation(progress);
  }, [flight.id, finish, progress]);
  useAnimatedReaction(
    () => progress.value >= RECEIVE_AT,
    (arriving, wasArriving) => {
      if (arriving && !wasArriving) receiveCart(reaction, badgeScale, false);
    },
  );
  const style = useAnimatedStyle(() => {
    const frame = sampleFlight(progress.value, flight.start, flight.end);
    return {
      opacity: frame.opacity,
      transform: [
        { translateX: frame.x - FLIGHT_SIZE / 2 },
        { translateY: frame.y - FLIGHT_SIZE / 2 },
        { scale: frame.scale },
      ],
    };
  });
  return (
    <Animated.View testID="cart-product-flight" style={[s.flight, style]}>
      <ProduceArt index={flight.art} size={FLIGHT_SIZE} radius={14} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  flight: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FLIGHT_SIZE,
    height: FLIGHT_SIZE,
  },
});
