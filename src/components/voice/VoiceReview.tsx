import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Check, Mic, ShoppingCart, Sparkles, TriangleAlert, Waves } from 'lucide-react-native';
import PressableScale from '../ui/PressableScale';
import ProduceArt from '../home/ProduceArt';
import { grocery } from '../home/groceryTheme';
import { productFor } from '../../state/cart';
import type { CatalogMatch } from '../../services/voiceCatalog';

/**
 * What a spoken order looks like while the app is working it out.
 *
 * This screen used to be a spinner with a label under it, then a stack of
 * white rectangles with the item names typed into them, then a second spinner
 * saying "Adding 3 items to your cart…". Three different waits, none of them
 * showing progress, all of them looking like the app had stopped — and the
 * items themselves were text, on a page whose whole language is photographs of
 * produce. Someone checking that we heard "do kilo tamatar" correctly was
 * being asked to read rather than to look.
 *
 * So: one rail across the top that says where in the pipeline we are and keeps
 * moving while we are there, rows that show the actual thing with its actual
 * price, and a final wait that draws itself down to zero and can be skipped by
 * tapping it. A wait you can watch end is not the same experience as a wait.
 *
 * Every piece of motion here is a shared value. The sheet is on screen at the
 * same moment the flight layer behind it is about to run, and a step rail that
 * re-rendered on a JS interval would be spending the animation's frame budget.
 */

const PALE_LINE = '#DCEFF8';
const WARN = '#D8853F';
const WARN_BG = '#FFF4E4';

/* ── The pipeline rail ─────────────────────────────────────────────────── */

export type VoiceStep = 'listening' | 'hearing' | 'matching' | 'cart';

const STEPS: { key: VoiceStep; label: string; Icon: typeof Mic }[] = [
  { key: 'listening', label: 'Listen', Icon: Mic },
  { key: 'hearing', label: 'Words', Icon: Waves },
  { key: 'matching', label: 'Match', Icon: Sparkles },
  { key: 'cart', label: 'Cart', Icon: ShoppingCart },
];

/**
 * Where we are, as four nodes and three lines.
 *
 * `at` is the index of the step in progress. Everything before it is done and
 * shows a tick; the step itself breathes, which is the part that matters —
 * transcription can take four seconds on a bad connection and a static "in
 * progress" dot is indistinguishable from a frozen one.
 */
export function VoiceSteps({ at, failed = false }: { at: number; failed?: boolean }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(at);
  const pulse = useSharedValue(0);

  useEffect(() => {
    progress.value = reduced
      ? at
      : withSpring(at, { damping: 18, stiffness: 140, mass: 0.7 });
  }, [at, reduced, progress]);

  useEffect(() => {
    cancelAnimation(pulse);
    if (reduced || failed) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 620, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [reduced, failed, pulse]);

  return (
    <View style={s.rail} accessibilityRole="progressbar" accessibilityLabel={`Step ${at + 1} of ${STEPS.length}`}>
      {STEPS.map((step, index) => (
        <View key={step.key} style={s.railCell}>
          {index > 0 ? (
            <Connector index={index} progress={progress} />
          ) : null}
          <StepNode
            index={index}
            at={at}
            label={step.label}
            Icon={step.Icon}
            progress={progress}
            pulse={pulse}
            failed={failed}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * The line into a node, filled from the left as the rail advances.
 *
 * Filled rather than switched: a line that flips colour when the step changes
 * makes four discrete states, and the customer cannot tell a slow step from a
 * stuck one. A line that is 40% full is a step that is happening.
 */
function Connector({
  index,
  progress,
}: {
  index: number;
  progress: SharedValue<number>;
}) {
  const fill = useAnimatedStyle(() => ({
    // The line before node `index` fills as progress crosses index-1 → index.
    // Scaled rather than widened: an animated width is a layout pass per
    // frame, and this is on screen at the moment the flight layer behind the
    // sheet needs every one of them.
    transform: [
      { scaleX: Math.min(1, Math.max(0, progress.value - (index - 1))) },
    ],
  }));
  return (
    <View style={s.track}>
      <Animated.View style={[s.trackFill, fill]} />
    </View>
  );
}

function StepNode({
  index,
  at,
  label,
  Icon,
  progress,
  pulse,
  failed,
}: {
  index: number;
  /**
   * The live step, as a prop rather than as a reading of `progress`.
   *
   * The glyph's colour is a render-time decision, and `progress` is a shared
   * value that moves on the UI thread without re-rendering anything — so a
   * colour derived from it is the colour this node had when it last happened
   * to render. The animated styles below still follow the shared value, which
   * is what keeps the transition smooth; only the colour follows React.
   */
  at: number;
  label: string;
  Icon: typeof Mic;
  progress: SharedValue<number>;
  pulse: SharedValue<number>;
  failed: boolean;
}) {
  /** 0 → not reached, 1 → in progress, 2 → done. */
  const state = useDerivedValue(() => {
    const p = progress.value;
    if (p >= index + 0.85) return 2;
    if (p >= index - 0.15) return 1;
    return 0;
  });

  const dot = useAnimatedStyle(() => {
    const here = state.value === 1 ? 1 : 0;
    const done = state.value === 2 ? 1 : 0;
    const breathe = failed ? 0 : here * pulse.value;
    return {
      backgroundColor: interpolateColor(
        done + here,
        [0, 1, 2],
        ['#EAF3F8', failed ? WARN_BG : grocery.blue, grocery.green],
      ),
      transform: [{ scale: 1 + 0.08 * breathe + 0.04 * done }],
    };
  });

  // The halo is the "still working" signal: it blooms out of the live node and
  // is invisible on every other one.
  const halo = useAnimatedStyle(() => {
    const here = state.value === 1 && !failed ? 1 : 0;
    return {
      opacity: here * (0.34 - 0.3 * pulse.value),
      transform: [{ scale: 1 + 0.85 * pulse.value }],
    };
  });

  const tick = useAnimatedStyle(() => ({
    opacity: state.value === 2 ? 1 : 0,
    transform: [{ scale: state.value === 2 ? 1 : 0.6 }],
  }));

  const glyph = useAnimatedStyle(() => ({
    opacity: state.value === 2 ? 0 : 1,
  }));

  const text = useAnimatedStyle(() => ({
    color: interpolateColor(
      state.value,
      [0, 1, 2],
      ['#9BB0BE', failed ? WARN : grocery.blue, grocery.ink],
    ),
    opacity: state.value === 0 ? 0.75 : 1,
  }));

  const live = index === at;

  return (
    <View style={s.node}>
      <View style={s.nodeArt}>
        <Animated.View pointerEvents="none" style={[s.halo, halo]} />
        <Animated.View style={[s.dot, dot]}>
          <Animated.View style={[s.glyphLayer, glyph]}>
            <Icon
              size={13}
              color={live || failed ? grocery.white : '#9BB0BE'}
              strokeWidth={2.4}
            />
          </Animated.View>
          <Animated.View style={[s.glyphLayer, tick]}>
            <Check size={13} color={grocery.white} strokeWidth={3} />
          </Animated.View>
        </Animated.View>
      </View>
      <Animated.Text numberOfLines={1} style={[s.nodeLabel, text]}>
        {label}
      </Animated.Text>
    </View>
  );
}

/* ── One detected item ─────────────────────────────────────────────────── */

/**
 * A row for something we heard.
 *
 * Shows the product, not a description of it. An item we could not match is
 * still shown — greyed, marked, and without a stepper — because a silently
 * dropped item is how an order arrives short, and the customer is the only one
 * who can say what they meant.
 *
 * `launching` is the beat before the flight: the row lifts and tips, so the
 * illustration that leaves the sheet a moment later is visibly the one that was
 * sitting here. Without it the sheet closes and something unrelated appears in
 * mid-air.
 */
export function VoiceItemRow({
  match,
  index,
  launching,
  onSetQuantity,
  onMeasure,
}: {
  match: CatalogMatch;
  index: number;
  launching: boolean;
  onSetQuantity: (quantity: number) => void;
  onMeasure: (productId: string, frame: LayoutRectangle) => void;
}) {
  const reduced = useReducedMotion();
  const matched = Boolean(match.productId);
  const unsure = match.confidence !== 'high';
  const product = match.productId ? productFor(match.productId) : undefined;
  const node = useRef<View>(null);

  const enter = useSharedValue(0);
  const lift = useSharedValue(0);
  const bump = useSharedValue(0);

  useEffect(() => {
    enter.value = reduced
      ? 1
      : withDelay(
          index * 70,
          withSpring(1, { damping: 17, stiffness: 190, mass: 0.7 }),
        );
  }, [enter, index, reduced]);

  useEffect(() => {
    if (!launching || reduced || !matched) return;
    lift.value = withDelay(
      index * 90,
      withSequence(
        withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 90 }),
      ),
    );
  }, [launching, reduced, matched, index, lift]);

  // Re-measured on every layout: the list reflows as quantities change, and
  // rows above this one can disappear.
  const measure = useCallback(() => {
    const id = match.productId;
    if (!id) return;
    node.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) onMeasure(id, { x, y, width, height });
    });
  }, [match.productId, onMeasure]);

  const shell = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: (1 - enter.value) * 14 - lift.value * 6 },
      { scale: 0.97 + 0.03 * enter.value + 0.02 * lift.value },
      { rotate: `${-1.4 * lift.value}deg` },
    ],
  }));

  const art = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.12 * bump.value + 0.06 * lift.value }],
  }));

  const step = (next: number) => {
    if (!reduced) {
      bump.value = withSequence(
        withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 12, stiffness: 260, mass: 0.5 }),
      );
    }
    onSetQuantity(next);
  };

  return (
    <Animated.View style={shell}>
      <View
        ref={node}
        collapsable={false}
        onLayout={measure}
        style={[s.row, !matched && s.rowMuted]}
      >
        <Animated.View style={[s.rowArt, art]}>
          {product ? (
            <ProduceArt index={product.art} size={44} radius={13} />
          ) : (
            <View style={s.rowArtBlank}>
              <TriangleAlert size={16} color={WARN} strokeWidth={2.3} />
            </View>
          )}
        </Animated.View>

        <View style={s.rowText}>
          <Text
            numberOfLines={1}
            style={[s.rowName, !matched && s.rowNameMuted]}
          >
            {match.productName ?? match.query}
          </Text>
          {matched ? (
            <View style={s.rowMetaLine}>
              <Text style={s.rowMeta} numberOfLines={1}>
                {match.quantity}
                {match.unit ? ` ${match.unit}` : ''}
                {product ? ` · Rs. ${product.price * match.quantity}` : ''}
              </Text>
              {unsure ? (
                <View style={s.checkPill}>
                  <Text style={s.checkPillText}>check</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={s.rowMeta} numberOfLines={2}>
              {match.unstocked
                ? `We don't sell ${match.unstocked} yet`
                : "We couldn't make this one out"}
            </Text>
          )}
        </View>

        {matched ? (
          <View style={s.stepper}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Less ${match.productName}`}
              onPress={() => step(Math.max(0, match.quantity - 1))}
              scaleTo={0.88}
              hitSlop={8}
              style={s.step}
            >
              <Text style={s.stepGlyph}>−</Text>
            </PressableScale>
            <Text style={s.stepQty}>{match.quantity}</Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`More ${match.productName}`}
              onPress={() => step(match.quantity + 1)}
              scaleTo={0.88}
              hitSlop={8}
              style={s.step}
            >
              <Text style={s.stepGlyph}>+</Text>
            </PressableScale>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

/* ── The last wait ─────────────────────────────────────────────────────── */

/**
 * The pause before the items fly.
 *
 * It was an ActivityIndicator with "Adding 3 items to your cart…" beside it,
 * held for the better part of a second on a screen where nothing else moved —
 * which is the exact shape of a hang. Nothing about it said how long, and
 * nothing let an impatient customer past it.
 *
 * Now it draws itself down. The bar is the remaining time, so a wait that is
 * nearly over looks nearly over, and tapping it goes straight through — the
 * delay exists so the matches can be read, and someone who has read them is
 * done with it.
 */
export function VoiceHandoff({
  count,
  durationMs,
  onSkip,
}: {
  count: number;
  durationMs: number;
  onSkip: () => void;
}) {
  const reduced = useReducedMotion();
  const fill = useSharedValue(1);

  useEffect(() => {
    fill.value = 1;
    fill.value = withTiming(0, {
      duration: durationMs,
      easing: Easing.linear,
    });
    return () => cancelAnimation(fill);
  }, [durationMs, fill]);

  const bar = useAnimatedStyle(() => ({
    transform: [{ scaleX: reduced ? 1 : fill.value }],
  }));

  const cart = useAnimatedStyle(() => {
    // Rocks forward once as the bar runs out, so the button itself anticipates
    // the flight rather than simply ending.
    const t = 1 - fill.value;
    return {
      transform: [
        { translateX: interpolate(t, [0, 0.7, 1], [0, 1, 7]) },
        { rotate: `${interpolate(t, [0, 0.7, 1], [0, -2, -7])}deg` },
      ],
    };
  });

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Add ${count} ${count === 1 ? 'item' : 'items'} to your cart now`}
      onPress={onSkip}
      scaleTo={0.98}
      style={s.handoff}
    >
      <Animated.View pointerEvents="none" style={[s.handoffBar, bar]} />
      <View style={s.handoffFace}>
        <Animated.View style={cart}>
          <ShoppingCart size={16} color={grocery.blue} strokeWidth={2.5} />
        </Animated.View>
        <Text style={s.handoffText}>
          Adding {count} {count === 1 ? 'item' : 'items'} to your cart
        </Text>
      </View>
    </PressableScale>
  );
}

/* ── Working, with something to look at ────────────────────────────────── */

/**
 * The transcribe and parse waits.
 *
 * Three dots on a rising sine rather than a spinner, because a spinner is the
 * one animation that looks identical whether the request is alive or dead. The
 * rail above it has already said which stage this is, so this only has to say
 * "still going".
 */
export function VoicePulse({ label }: { label: string }) {
  return (
    <View style={s.pulse}>
      <View style={s.pulseDots}>
        {[0, 1, 2].map(index => (
          <PulseDot key={index} index={index} />
        ))}
      </View>
      <Text style={s.pulseLabel}>{label}</Text>
    </View>
  );
}

function PulseDot({ index }: { index: number }) {
  const reduced = useReducedMotion();
  const beat = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(beat);
    if (reduced) {
      beat.value = 0.5;
      return;
    }
    beat.value = withDelay(
      index * 130,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 480, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(beat);
  }, [beat, index, reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * beat.value,
    transform: [
      { translateY: -6 * beat.value },
      { scale: 0.82 + 0.28 * beat.value },
    ],
  }));

  return <Animated.View style={[s.pulseDot, style]} />;
}

const s = StyleSheet.create({
  /* rail */
  rail: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 4 },
  railCell: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  node: { width: 52, alignItems: 'center', gap: 5 },
  nodeArt: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: grocery.blue,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.2 },
  // Sits behind the two nodes it joins, and is inset so it never pokes out
  // from under a dot.
  track: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    marginHorizontal: -4,
    marginBottom: 16,
    backgroundColor: '#E3EFF5',
    overflow: 'hidden',
  },
  trackFill: {
    height: 2.5,
    width: '100%',
    borderRadius: 2,
    backgroundColor: grocery.blue,
    transformOrigin: 'left',
  },

  /* rows */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: grocery.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALE_LINE,
    paddingHorizontal: 11,
    paddingVertical: 9,
    shadowColor: '#416A80',
    shadowOpacity: 0.05,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  rowMuted: {
    backgroundColor: WARN_BG,
    borderColor: '#F0DEC4',
    shadowOpacity: 0,
    elevation: 0,
  },
  rowArt: { borderRadius: 13 },
  rowArtBlank: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE7C7',
  },
  rowText: { flex: 1, gap: 3 },
  rowName: { fontSize: 14, fontWeight: '800', color: grocery.ink },
  rowNameMuted: { color: '#8A7460' },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowMeta: { flexShrink: 1, fontSize: 11.5, fontWeight: '600', color: grocery.muted },
  checkPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 7,
    backgroundColor: WARN_BG,
  },
  checkPillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: WARN,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 3,
    borderRadius: 15,
    backgroundColor: grocery.pale,
  },
  step: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: grocery.white,
  },
  stepGlyph: { fontSize: 15, lineHeight: 18, fontWeight: '800', color: grocery.blue },
  stepQty: {
    minWidth: 20,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '900',
    color: grocery.ink,
    fontVariant: ['tabular-nums'],
  },

  /* handoff */
  handoff: {
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: grocery.pale,
    justifyContent: 'center',
  },
  // Scaled from the left so it drains rather than slides.
  handoffBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#CFEAF8',
    transformOrigin: 'left',
  },
  handoffFace: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  handoffText: { fontSize: 14, fontWeight: '800', color: grocery.blue },

  /* pulse */
  pulse: { alignItems: 'center', gap: 13, paddingVertical: 22 },
  pulseDots: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 18 },
  pulseDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: grocery.blue,
  },
  pulseLabel: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '600',
    color: grocery.muted,
    textAlign: 'center',
  },
});
