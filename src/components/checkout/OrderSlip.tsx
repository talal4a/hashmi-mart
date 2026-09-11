import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Printer as PrinterIcon, Scissors } from 'lucide-react-native';
import PressableScale from '../ui/PressableScale';
import { grocery } from '../home/groceryTheme';
import { tapHandoff, tapSend } from '../voice/haptics';
import { money } from '../../services/pricing';
import type { Receipt } from '../../services/receipt';

/**
 * The order slip, printed and then torn off.
 *
 * A reference code in 15pt blue text is a string. It is correct, and nobody
 * believes it — an order placed in a shop ends with a docket in your hand, and
 * the screen that replaced the docket kept the information and threw away the
 * whole of what made it feel settled. So this prints one: the paper feeds out
 * of the machine a step at a time the way thermal paper actually does, and it
 * is yours when you tear it off.
 *
 * The tear is the part worth getting right, because everyone has done it.
 * Pulling paper off a printer is three separate things in about half a second
 * and skipping any of them looks like a fade:
 *
 *   the paper is drawn back      tensioning it against the cutter
 *   the blade crosses            left to right, one pass
 *   the two pieces come apart    the stub goes back in, the receipt drops
 *
 * The second and third are what the eye is actually watching for. A slip that
 * simply splits in half has no cutter in it; a slip that splits without the
 * pull-back has no tension in it, and reads as tearing wet paper.
 *
 * All of it is shared values. The screen underneath is the one the customer
 * just paid on and it is still settling in — this cannot be spending frames on
 * the JS thread while that happens.
 */

/**
 * The blank strip above the perforation.
 *
 * It is the piece that stays with the machine, so it is exactly as tall as a
 * leader needs to be and no taller: a stub with anything printed on it looks
 * like the receipt lost a line in the cut.
 */
const LEADER = 34;

/** How far the paper is pulled back onto the cutter before the blade moves. */
const PULL_BACK = 15;

const PAPER = '#FFFDF7';
const PAPER_EDGE = '#EDE6D8';
const INK = '#2A2622';
const FADED = '#8C8479';
const CASING = '#132A38';
const CASING_LIP = '#0A1D28';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/** The cutter carriage's width, needed by both its style and its travel. */
const CARRIAGE_W = 26;

/** Timings, named because the sequence only works in this order. */
const FEED_MS = 1500;
const PULL_MS = 190;
const BLADE_MS = 300;
const PART_MS = 620;

type Props = {
  receipt: Receipt;
  /** Called once the slip has been torn off and settled. */
  onTorn?: () => void;
  /** Prints or shares the same order. Omitted, the button is not offered. */
  onPrint?: () => void;
  /** Shown on the print button while a sheet is open over the app. */
  printing?: boolean;
};

export default function OrderSlip({ receipt, onTorn, onPrint, printing }: Props) {
  const reduced = useReducedMotion();

  /**
   * The slip's own height, measured rather than counted.
   *
   * The cut has to divide a real number of pixels into two pieces, and the
   * number depends on how many things were bought. Adding up line heights by
   * hand is a calculation that is right until someone changes a font size and
   * then silently cuts through the middle of a row.
   */
  const [height, setHeight] = useState(0);
  const [torn, setTorn] = useState(false);

  /** 0 → still inside the machine, 1 → fully fed out. */
  const feed = useSharedValue(0);
  /** The shudder of the print head, only while paper is moving. */
  const shake = useSharedValue(0);
  /** 0 → at rest, 1 → drawn back onto the cutter. */
  const pull = useSharedValue(0);
  /** The blade's travel across the slot, 0 → 1. */
  const blade = useSharedValue(0);
  /** How far apart the two pieces have come. */
  const part = useSharedValue(0);
  /** Lit while the machine is working. */
  const lamp = useSharedValue(0);
  /**
   * How wide the slot actually is.
   *
   * The blade crosses it in pixels. A percentage would be simpler and is the
   * thing that quietly stops working the moment the carriage needs to start
   * just off the left edge and finish just off the right one.
   */
  const span = useSharedValue(0);

  const measure = useCallback((next: number) => {
    setHeight(current => (current === next ? current : next));
  }, []);

  // The feed. Stepped rather than smooth: thermal paper advances one line at a
  // time and the ticking is most of what makes it read as a machine and not as
  // a card sliding in.
  useEffect(() => {
    if (!height) return;
    if (reduced) {
      feed.value = 1;
      lamp.value = 0;
      return;
    }
    tapSend();
    // Blinks for exactly as long as the paper is moving, then rests lit. An
    // endless repeat would need the feed's completion callback to stop it —
    // which is a status light that stays blinking on any frame that callback
    // does not arrive on.
    lamp.value = withSequence(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
          withTiming(0.25, { duration: 260, easing: Easing.in(Easing.quad) }),
        ),
        Math.round(FEED_MS / 520),
        false,
      ),
      withTiming(1, { duration: 200 }),
    );
    feed.value = withTiming(1, {
      duration: FEED_MS,
      easing: Easing.steps(22, true),
    });
    // Bounded the same way, and for the same reason.
    shake.value = withSequence(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 34, easing: Easing.linear }),
          withTiming(-1, { duration: 34, easing: Easing.linear }),
        ),
        Math.round(FEED_MS / 68),
        false,
      ),
      withTiming(0, { duration: 60 }),
    );
    return () => {
      cancelAnimation(feed);
      cancelAnimation(shake);
      cancelAnimation(lamp);
    };
  }, [height, reduced, feed, shake, lamp]);

  /**
   * Settling is on a timer, not on the animation's completion callback.
   *
   * A cut is committed the instant it is asked for — there is no un-tearing a
   * slip — so the state that guards a second press has to flip on the press,
   * not when the last spring finishes. And `onTorn` has to fire whether or not
   * the motion ever reaches its end: an animation cancelled by a re-render, by
   * Reduce Motion, or by the screen going away would otherwise leave whatever
   * is waiting on it waiting for ever, with the paper visibly in two pieces.
   */
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (settling.current) clearTimeout(settling.current);
    },
    [],
  );

  /**
   * Pull back, cut, come apart.
   *
   * Chained inside the worklets rather than by timers, so the blade cannot
   * start before the paper has finished being drawn back — which is the one
   * ordering mistake that makes the whole thing read as a crossfade.
   */
  const tear = useCallback(() => {
    if (torn) return;
    setTorn(true);

    if (reduced) {
      part.value = withTiming(1, { duration: 220 });
      blade.value = 1;
      onTorn?.();
      return;
    }
    tapSend();
    settling.current = setTimeout(
      () => onTorn?.(),
      PULL_MS + BLADE_MS * 0.42 + PART_MS,
    );
    pull.value = withTiming(
      1,
      { duration: PULL_MS, easing: Easing.in(Easing.quad) },
      finished => {
        'worklet';
        if (!finished) return;
        // The blade only crosses once the paper is tight against it.
        blade.value = withTiming(
          1,
          { duration: BLADE_MS, easing: Easing.bezier(0.5, 0, 0.35, 1) },
        );
        // And the halves start separating just behind its edge, not after it
        // has finished: paper opens up along the cut as the blade passes.
        part.value = withDelay(
          BLADE_MS * 0.42,
          withTiming(1, {
            duration: PART_MS,
            easing: Easing.bezier(0.3, 0, 0.2, 1),
          }),
        );
      },
    );
  }, [torn, reduced, pull, blade, part, onTorn]);

  // A slip still in the machine has nothing to tear; measured but unfed is a
  // button that cuts through paper that has not come out yet.
  const [ready, setReady] = useState(reduced);
  useEffect(() => {
    if (!height || reduced) return;
    const timer = setTimeout(() => setReady(true), FEED_MS);
    return () => clearTimeout(timer);
  }, [height, reduced]);

  /** Where the whole sheet sits: fed out, minus whatever the cutter took back. */
  const sheet = useAnimatedStyle(() => {
    // Always the same keys. A style that returns `{opacity}` on one frame and
    // `{opacity, transform}` on the next leaves the dropped property stuck at
    // whatever it last was.
    const out = height ? interpolate(feed.value, [0, 1], [-height, 0]) : 0;
    return {
      opacity: height ? 1 : 0,
      transform: [
        { translateY: out - PULL_BACK * pull.value },
        { translateX: shake.value * 0.5 },
      ],
    };
  });

  /**
   * The stub: back into the machine, and gone.
   *
   * It leaves faster than the receipt falls, which is what sells the two of
   * them as one sheet that has just stopped being one sheet.
   */
  const stub = useAnimatedStyle(() => ({
    transform: [
      { translateY: -(LEADER + 10) * part.value },
    ],
    opacity: 1 - part.value * part.value,
  }));

  /**
   * The receipt: free of the machine, so it drops, tips and settles.
   *
   * The tip is deliberate and small. Paper that comes off a cutter is never
   * quite square afterwards, and 1.4° is the difference between a printed
   * receipt and a rectangle that moved down the screen.
   */
  const keep = useAnimatedStyle(() => {
    const p = part.value;
    return {
      transform: [
        { translateY: interpolate(p, [0, 0.55, 1], [0, 16, 22]) },
        { rotate: `${interpolate(p, [0, 0.5, 1], [0, 1.9, 1.4])}deg` },
      ],
    };
  });

  /** The shadow arrives as the receipt does: it is what says it came free. */
  const lift = useAnimatedStyle(() => ({
    opacity: 0.16 * part.value,
    transform: [{ scaleX: 0.9 + 0.1 * part.value }],
  }));

  return (
    <View style={s.stage}>
      <Printer lamp={lamp} shake={shake} />

      <View
        testID="order-slip-bay"
        style={[s.bay, height ? { height: height + 70 } : null]}
        onLayout={event => {
          span.value = event.nativeEvent.layout.width;
        }}
      >
        <Animated.View style={[s.sheet, sheet]}>
          {/* One sheet, drawn as the two pieces it is about to become. Both
              halves carry the same face at different offsets, so before the
              cut there is no seam to see and after it there are two objects
              rather than one object with a line across it. */}
          <Animated.View style={[s.stub, stub]}>
            <View style={s.stubPaper}>
              <View style={s.stubGrain} />
            </View>
            <Perforation />
          </Animated.View>

          <Animated.View style={keep}>
            <Animated.View pointerEvents="none" style={[s.lift, lift]} />
            <View style={s.keep}>
              <SlipFace
                receipt={receipt}
                onHeight={next => measure(next + LEADER)}
              />
              <TornEdge />
            </View>
          </Animated.View>
        </Animated.View>

        {/* The cutter runs in the slot, above the paper and below the housing's
            lip, which is where a cutter is. */}
        <Blade blade={blade} span={span} />
      </View>

      <View style={s.tools}>
        {onPrint ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Print this receipt"
            accessibilityState={{ disabled: !ready || printing }}
            onPress={() => {
              if (!ready || printing) return;
              onPrint();
            }}
            scaleTo={0.96}
            style={[s.tool, s.toolGhost, (!ready || printing) && s.toolOff]}
          >
            <PrinterIcon size={15} color={grocery.blue} strokeWidth={2.4} />
            <Text style={s.toolGhostText}>
              {printing ? 'Printing…' : 'Print receipt'}
            </Text>
          </PressableScale>
        ) : null}

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={torn ? 'Slip torn off' : 'Tear off the slip'}
          accessibilityState={{ disabled: torn || !ready }}
          onPress={() => {
            if (!ready || torn) return;
            tapHandoff();
            tear();
          }}
          scaleTo={0.96}
          style={[s.tool, s.toolSolid, (torn || !ready) && s.toolOff]}
        >
          <Scissors
            size={15}
            color={torn ? FADED : grocery.white}
            strokeWidth={2.4}
          />
          <Text style={[s.toolSolidText, torn && s.toolOffText]}>
            {torn ? 'Torn off' : ready ? 'Tear it' : 'Printing…'}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

/* ── The machine ───────────────────────────────────────────────────────── */

function Printer({
  lamp,
  shake,
}: {
  lamp: SharedValue<number>;
  shake: SharedValue<number>;
}) {
  const body = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value * 0.7 }],
  }));
  const led = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * lamp.value,
    transform: [{ scale: 0.9 + 0.2 * lamp.value }],
  }));
  return (
    <Animated.View style={[s.printer, body]}>
      <View style={s.printerFace}>
        <Animated.View style={[s.led, led]} />
        <Text style={s.printerName}>HASHMIMART</Text>
        <View style={s.vents}>
          {[0, 1, 2].map(index => (
            <View key={index} style={s.vent} />
          ))}
        </View>
      </View>
      {/* The mouth. Dark, inset and the full width, so the paper reads as
          coming out of the machine rather than out from behind it. */}
      <View style={s.slot}>
        <View style={s.slotShade} />
      </View>
    </Animated.View>
  );
}

/**
 * The cutter.
 *
 * One pass, left to right, with the cut line opening behind it. The gleam on
 * the carriage is what makes it metal — a plain dark block crossing the slot
 * reads as a loading bar.
 */
function Blade({
  blade,
  span,
}: {
  blade: SharedValue<number>;
  span: SharedValue<number>;
}) {
  const carriage = useAnimatedStyle(() => {
    const t = blade.value;
    // Starts fully off the left edge and ends fully off the right one, so the
    // carriage is never parked half-visible at either end of its travel.
    const travel = span.value + CARRIAGE_W;
    return {
      opacity: t > 0 && t < 1 ? 1 : 0,
      transform: [{ translateX: -CARRIAGE_W + t * travel }],
    };
  });
  const line = useAnimatedStyle(() => ({
    opacity: blade.value > 0 ? 1 - Math.max(0, blade.value - 0.75) * 4 : 0,
    transform: [{ scaleX: blade.value }],
  }));
  const glint = useAnimatedStyle(() => {
    const t = blade.value;
    return { opacity: t > 0 && t < 1 ? 0.55 + 0.45 * Math.sin(t * Math.PI) : 0 };
  });
  return (
    <View pointerEvents="none" style={s.cutter}>
      <Animated.View style={[s.cutLine, line]} />
      <Animated.View style={[s.carriage, carriage]}>
        <View style={s.carriageBody} />
        <Animated.View style={[s.carriageGlint, glint]} />
        <View style={s.carriageEdge} />
      </Animated.View>
    </View>
  );
}

/** The row of holes the paper gives way along. */
function Perforation() {
  return (
    <View pointerEvents="none" style={s.perf}>
      {PERF_DOTS.map(index => (
        <View key={index} style={s.perfDot} />
      ))}
    </View>
  );
}

const PERF_DOTS = Array.from({ length: 26 }, (_, index) => index);

/** The bottom of a roll: torn, not cut. */
function TornEdge() {
  return (
    <View pointerEvents="none" style={s.tornEdge}>
      {TEETH.map(index => (
        <View key={index} style={s.tooth} />
      ))}
    </View>
  );
}

const TEETH = Array.from({ length: 21 }, (_, index) => index);

/* ── What is printed on it ─────────────────────────────────────────────── */

function SlipFace({
  receipt,
  onHeight,
}: {
  receipt: Receipt;
  onHeight: (height: number) => void;
}) {
  return (
    <View
      // Named so a test can hand it the layout that a real screen would.
      testID="order-slip-face"
      style={s.face}
      onLayout={event => onHeight(Math.round(event.nativeEvent.layout.height))}
    >
      <Text style={s.brand}>HASHMI MART</Text>
      <Text style={s.small}>Fresh grocery · Cash on delivery</Text>
      <Rule />

      <Text style={s.refLabel}>ORDER CONFIRMED</Text>
      <Text style={s.ref} selectable>
        {receipt.reference}
      </Text>
      <Text style={s.small}>
        {receipt.placedAt.toLocaleString('en-PK')}
      </Text>
      <Rule />

      {receipt.lines.map(line => (
        <View key={line.id} style={s.item}>
          <Text style={s.itemQty}>{line.quantity}×</Text>
          <Text style={s.itemName} numberOfLines={1}>
            {line.name}
          </Text>
          <Text style={s.itemPrice}>{money(line.total)}</Text>
        </View>
      ))}
      <Rule />

      <Line label="Subtotal" value={money(receipt.subtotal)} />
      {receipt.discount > 0 ? (
        <Line label="Discount" value={`- ${money(receipt.discount)}`} />
      ) : null}
      <Line
        label="Delivery"
        value={receipt.deliveryFee === 0 ? 'FREE' : money(receipt.deliveryFee)}
      />
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>TOTAL</Text>
        <Text style={s.totalValue}>{money(receipt.total)}</Text>
      </View>
      <Rule />

      <Line label="Payment" value="Cash on delivery" />
      <View style={s.to}>
        <Text style={s.toLabel}>DELIVER TO</Text>
        <Text style={s.toLine}>{receipt.name}</Text>
        <Text style={s.toLine}>+92 {receipt.phone}</Text>
        <Text style={s.toLine}>{receipt.area}</Text>
        <Text style={s.toLine}>{receipt.address}</Text>
      </View>

      <Barcode seed={receipt.reference} />
      <Text style={s.thanks}>SHUKRIYA · THANK YOU</Text>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.line}>
      <Text style={s.lineLabel}>{label}</Text>
      <Text style={s.lineValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/** Drawn as dashes rather than a dashed border, which Android renders solid. */
function Rule() {
  return (
    <View style={s.rule}>
      {RULE_DASHES.map(index => (
        <View key={index} style={s.dash} />
      ))}
    </View>
  );
}

const RULE_DASHES = Array.from({ length: 34 }, (_, index) => index);

/**
 * A barcode that encodes nothing, derived from the reference.
 *
 * It is a texture, and it says so by being derived from the code printed above
 * it rather than random: two slips with the same reference look the same,
 * which is the only property anyone could check.
 */
function Barcode({ seed }: { seed: string }) {
  const bars = [];
  let hash = 7;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  for (let index = 0; index < 44; index += 1) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    const wide = (hash >>> 16) % 3;
    bars.push(
      <View
        key={index}
        style={[s.bar, { width: 1 + wide, opacity: wide === 0 ? 0.55 : 1 }]}
      />,
    );
  }
  return <View style={s.barcode}>{bars}</View>;
}

const s = StyleSheet.create({
  stage: { alignItems: 'center', alignSelf: 'stretch' },

  /* machine */
  printer: { width: '100%', maxWidth: 320, zIndex: 3 },
  printerFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 40,
    paddingHorizontal: 14,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: CASING,
  },
  printerName: {
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#7FB6D0',
  },
  led: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  vents: { flexDirection: 'row', gap: 3 },
  vent: { width: 3, height: 12, borderRadius: 2, backgroundColor: '#20404F' },
  slot: {
    height: 13,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: CASING_LIP,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  slotShade: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#02090D',
  },

  /* the paper's run */
  bay: {
    width: '100%',
    maxWidth: 320,
    // Everything above this line is the machine, so the paper is clipped at
    // the top: a piece travelling up does not rise past the slot, it goes into
    // it. The extra height below is the room the receipt drops into.
    overflow: 'hidden',
    zIndex: 1,
  },
  sheet: { width: '100%' },

  stub: { width: '100%' },
  stubPaper: {
    height: LEADER,
    backgroundColor: PAPER,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: PAPER_EDGE,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  stubGrain: { height: 1, backgroundColor: '#F1EADA' },
  perf: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: -1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  perfDot: {
    width: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: PAPER_EDGE,
  },

  keep: {
    backgroundColor: PAPER,
    borderWidth: 1,
    borderColor: PAPER_EDGE,
    borderTopWidth: 0,
    shadowColor: '#2F2A22',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  lift: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: -7,
    height: 12,
    borderRadius: 8,
    backgroundColor: '#2F2A22',
  },

  /* cutter */
  cutter: {
    position: 'absolute',
    top: LEADER - 1,
    left: 0,
    right: 0,
    height: 12,
    zIndex: 4,
  },
  cutLine: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FFFFFF',
    transformOrigin: 'left',
  },
  carriage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CARRIAGE_W,
    height: 12,
  },
  carriageBody: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    height: 9,
    borderRadius: 3,
    backgroundColor: '#33505F',
  },
  carriageGlint: {
    position: 'absolute',
    top: 2,
    left: 3,
    right: 3,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#D9F1FF',
  },
  // The edge that is actually doing the cutting, at the leading side.
  carriageEdge: {
    position: 'absolute',
    top: 0,
    right: -1,
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#EAF7FF',
  },

  /* printed face */
  face: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 4 },
  brand: {
    fontFamily: MONO,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 3,
    color: INK,
    textAlign: 'center',
  },
  small: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.6,
    color: FADED,
    textAlign: 'center',
  },
  rule: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  dash: { width: 4, height: 1, backgroundColor: '#CFC6B4' },

  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineLabel: {
    width: 68,
    fontFamily: MONO,
    fontSize: 9.5,
    letterSpacing: 0.4,
    color: FADED,
    textTransform: 'uppercase',
  },
  lineValue: {
    flex: 1,
    fontFamily: MONO,
    fontSize: 10.5,
    lineHeight: 15,
    color: INK,
    textAlign: 'right',
  },

  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemQty: { fontFamily: MONO, fontSize: 10.5, color: FADED, width: 24 },
  itemName: { flex: 1, fontFamily: MONO, fontSize: 10.5, color: INK },
  itemPrice: {
    fontFamily: MONO,
    fontSize: 10.5,
    color: INK,
    fontVariant: ['tabular-nums'],
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
  },
  totalLabel: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    color: INK,
  },
  totalValue: {
    fontFamily: MONO,
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },

  refLabel: {
    fontFamily: MONO,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: FADED,
    textAlign: 'center',
    marginTop: 2,
  },
  to: { marginTop: 6, gap: 1 },
  toLabel: {
    fontFamily: MONO,
    fontSize: 8.5,
    letterSpacing: 1.4,
    color: FADED,
  },
  toLine: { fontFamily: MONO, fontSize: 10.5, lineHeight: 15, color: INK },
  ref: {
    fontFamily: MONO,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: INK,
    textAlign: 'center',
  },
  barcode: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 1.5,
    height: 34,
    marginTop: 8,
  },
  bar: { height: '100%', backgroundColor: INK },
  thanks: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 2,
    color: FADED,
    textAlign: 'center',
    marginTop: 6,
  },

  // Notches taken out of the bottom edge, in the colour of what is behind the
  // paper — so the slip ends in a tear rather than in a ruled line.
  tornEdge: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  tooth: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: grocery.canvas,
  },

  /* the buttons */
  tools: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 44,
    alignSelf: 'stretch',
    maxWidth: 320,
  },
  tool: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 23,
  },
  toolGhost: {
    backgroundColor: grocery.white,
    borderWidth: 1.5,
    borderColor: '#CFEAF8',
  },
  toolSolid: { backgroundColor: grocery.blue },
  toolOff: { opacity: 0.55 },
  toolGhostText: { fontSize: 13.5, fontWeight: '800', color: grocery.blue },
  toolSolidText: { fontSize: 13.5, fontWeight: '800', color: grocery.white },
  toolOffText: { color: FADED },
});
