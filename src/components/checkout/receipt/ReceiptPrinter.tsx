import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { buildReceiptLayout, PAPER_COLOR, PAPER_WIDTH } from './receiptModel';
import { buildPaperPath, PaperArtwork, ReceiptPiece } from './ReceiptPaper';
import type { ReceiptOrder } from './types';

export type ReceiptPhase = 'printing' | 'ready' | 'tearing' | 'done';
const ROWS = 8;
const COLS = 2;

export default function ReceiptPrinter({
  order,
  phase,
  onPrinted,
  onTorn,
}: {
  order: ReceiptOrder;
  phase: ReceiptPhase;
  onPrinted: () => void;
  onTorn: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const reduced = useReducedMotion();
  const layout = useMemo(() => buildReceiptLayout(order, fontScale), [order, fontScale]);

  const machineWidth = Math.min(width - 40, 320);
  const paperWidth = Math.min(PAPER_WIDTH, machineWidth - 54);
  const scale = paperWidth / PAPER_WIDTH;
  const paperHeight = (layout.height + 6) * scale;

  const feed = useSharedValue(0);
  const tear = useSharedValue(0);
  const ledPulse = useSharedValue(0.4);
  const [printed, setPrinted] = useState(false);

  const finishPrint = useCallback(() => {
    setPrinted(true);
    onPrinted();
    if (!reduced) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [onPrinted, reduced]);

  // Feed animation on mount
  useEffect(() => {
    feed.value = 0;
    ledPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.35, { duration: 400 }),
      ),
      -1,
      true,
    );

    if (!reduced) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    feed.value = withDelay(
      reduced ? 0 : 200,
      withTiming(
        1,
        {
          duration: reduced ? 180 : 1950,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        },
        finished => {
          if (finished) runOnJS(finishPrint)();
        },
      ),
    );

    return () => {
      cancelAnimation(feed);
      cancelAnimation(ledPulse);
    };
  }, [feed, ledPulse, reduced, finishPrint]);

  // Tearing animation
  useEffect(() => {
    if (phase !== 'tearing') return;
    tear.value = withTiming(
      1,
      {
        duration: reduced ? 180 : 1200,
        easing: Easing.bezier(0.18, 0.89, 0.32, 1.0),
      },
      finished => {
        if (finished) runOnJS(onTorn)();
      },
    );
    return () => cancelAnimation(tear);
  }, [phase, tear, reduced, onTorn]);

  // Paper motion: feeds down smoothly, snaps upward slightly on initial rip, then dissolves
  const paperMotion = useAnimatedStyle(() => ({
    opacity: reduced ? feed.value * (1 - tear.value) : phase === 'done' ? 0 : 1,
    transform: [
      {
        translateY: reduced
          ? 0
          : (1 - feed.value) * -(paperHeight + 12) +
            // Initial tension snap upward when user tears
            interpolate(tear.value, [0, 0.04, 0.08, 0.15, 1], [0, -4, 2, 0, 0]),
      },
      {
        translateX: reduced
          ? 0
          : interpolate(tear.value, [0, 0.04, 0.08, 0.12, 0.16, 1], [0, -3, 3, -1.5, 0, 0]),
      },
    ],
  }));

  // Well height: contracts gracefully once paper has torn and faded away
  const wellStyle = useAnimatedStyle(() => ({
    height:
      phase === 'done'
        ? 20
        : interpolate(tear.value, [0.65, 1], [paperHeight + 20, 20]),
  }));

  // Status LED glow style
  const ledStyle = useAnimatedStyle(() => {
    if (phase === 'printing') {
      return { opacity: ledPulse.value };
    }
    if (phase === 'ready') {
      return { opacity: 1 };
    }
    return { opacity: 0.45 };
  });

  // Serrated paper stub peeking from the mouth after tear
  const stubMotion = useAnimatedStyle(() => ({
    opacity: tear.value > 0.05 || phase === 'done' ? 1 : 0,
    transform: [
      {
        translateY: interpolate(tear.value, [0, 0.3, 1], [-8, 0, 0]),
      },
    ],
  }));

  const stubPath = useMemo(
    () => buildPaperPath(PAPER_WIDTH, 0, 12, false, true),
    [],
  );

  const accessibleText = layout.rows
    .filter(row => row.text && !row.barcode)
    .map(row => `${row.text} ${row.right ?? ''}`)
    .join('. ');

  return (
    <Animated.View
      entering={FadeIn.duration(reduced ? 150 : 300)}
      style={[s.scene, { width: machineWidth }]}
    >
      {/* Paper Well (Clips paper as it ejects out of the slot) */}
      <Animated.View style={[s.well, { marginTop: 70 }, wellStyle]}>
        {/* Render paper only while printing or ready or active tearing — NEVER when done! */}
        {phase !== 'done' ? (
          <Animated.View
            accessible
            accessibilityLabel={accessibleText}
            style={[{ width: paperWidth, height: paperHeight, alignSelf: 'center' }, paperMotion]}
          >
            {phase === 'tearing' && !reduced ? (
              // 16 tiny pieces fluttering and tumbling in 3D
              Array.from({ length: ROWS * COLS }, (_, index) => {
                const r = Math.floor(index / COLS);
                const c = index % COLS;
                return (
                  <ReceiptPiece
                    key={index}
                    layout={layout}
                    row={r}
                    col={c}
                    totalRows={ROWS}
                    totalCols={COLS}
                    progress={tear}
                    scale={scale}
                  />
                );
              })
            ) : (
              <PaperArtwork layout={layout} />
            )}
          </Animated.View>
        ) : null}

        {/* Paper stub permanently left in the cutter teeth when torn */}
        <Animated.View
          pointerEvents="none"
          style={[s.stub, { width: paperWidth }, stubMotion]}
        >
          <Svg width="100%" height={14} viewBox={`0 0 ${PAPER_WIDTH} 14`}>
            <Path d={stubPath} fill={PAPER_COLOR} stroke="#E2DFD4" strokeWidth={0.8} />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* Sleek Metallic Capsule Printer (Modeled after CodePen IC-the-bold/pen/dPPwJpW) */}
      <View pointerEvents="none" style={[s.machine, { width: machineWidth }]}>
        <View style={[s.machineShadow, { width: machineWidth }]} />

        <LinearGradient
          colors={['#9DA2A9', '#FFFFFF', '#EFF1F4', '#D4D8DE', '#BEC3C9', '#9BA0A7']}
          locations={[0, 0.05, 0.2, 0.52, 0.85, 1.0]}
          style={[s.machineBody, { width: machineWidth }]}
        >
          <View style={s.specularHighlight} />

          <View style={s.machineFace}>
            <View style={s.brandGroup}>
              <Animated.View style={[s.ledOuter, ledStyle]}>
                <View
                  style={[
                    s.ledCore,
                    {
                      backgroundColor:
                        phase === 'printing'
                          ? '#22C55E'
                          : phase === 'ready'
                          ? '#10B981'
                          : '#94A3B8',
                    },
                  ]}
                />
              </Animated.View>
              <View>
                <Text style={s.brandText}>HASHMIPRINT</Text>
                <Text style={s.brandSubtext}>THERMAL POS</Text>
              </View>
            </View>

            <View style={s.vents}>
              <View style={s.ventBar} />
              <View style={s.ventBar} />
              <View style={s.ventBar} />
            </View>
          </View>

          <View style={[s.slotFrame, { width: paperWidth + 14 }]}>
            <View style={s.slotChamber} />
          </View>

          <View style={s.bottomEdgeBevel} />
        </LinearGradient>

        <LinearGradient
          pointerEvents="none"
          colors={['rgba(15, 17, 21, 0.45)', 'rgba(15, 17, 21, 0.15)', 'rgba(15, 17, 21, 0)']}
          style={[s.contactShadow, { width: paperWidth }]}
        />
      </View>

      {/* Minimalist Status Feedback Pill */}
      <View style={s.statusPill}>
        <View
          style={[
            s.statusDot,
            {
              backgroundColor:
                phase === 'printing'
                  ? '#22C55E'
                  : phase === 'ready'
                  ? '#10B981'
                  : phase === 'tearing'
                  ? '#F59E0B'
                  : '#10B981',
            },
          ]}
        />
        <Text accessibilityLiveRegion="polite" style={s.statusCaption}>
          {phase === 'tearing'
            ? 'Tearing into pieces…'
            : phase === 'done'
            ? 'Receipt torn • Order confirmed'
            : printed
            ? 'Receipt ready • Tap "Tear It" below'
            : 'Printing your receipt…'}
        </Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  scene: {
    alignSelf: 'center',
    marginTop: 14,
    alignItems: 'center',
  },
  well: {
    overflow: 'hidden',
    paddingBottom: 20,
    alignItems: 'center',
  },
  machine: {
    position: 'absolute',
    top: 0,
    height: 94,
    alignItems: 'center',
  },
  machineShadow: {
    position: 'absolute',
    top: 6,
    height: 88,
    borderRadius: 16,
    backgroundColor: '#000000',
    opacity: 0.16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  machineBody: {
    position: 'absolute',
    top: 0,
    height: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#B0B5BB',
    overflow: 'hidden',
  },
  specularHighlight: {
    height: 2.5,
    marginTop: 3,
    marginHorizontal: 18,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  machineFace: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ledOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  ledCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  brandText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#374151',
  },
  brandSubtext: {
    fontSize: 6.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#6B7280',
    marginTop: 1,
  },
  vents: {
    flexDirection: 'row',
    gap: 3.5,
    alignItems: 'center',
  },
  ventBar: {
    width: 2.5,
    height: 14,
    borderRadius: 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRightWidth: 0.8,
    borderRightColor: 'rgba(255, 255, 255, 0.65)',
  },
  slotFrame: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0B0C0E',
    borderTopWidth: 1.2,
    borderTopColor: '#000000',
    borderBottomWidth: 0.8,
    borderBottomColor: 'rgba(255, 255, 255, 0.45)',
    overflow: 'hidden',
  },
  slotChamber: {
    flex: 1,
    backgroundColor: '#050607',
  },
  bottomEdgeBevel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  contactShadow: {
    position: 'absolute',
    top: 78,
    height: 14,
  },
  stub: {
    position: 'absolute',
    top: 0,
    height: 14,
    alignSelf: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(241, 245, 249, 0.85)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusCaption: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
    letterSpacing: 0.1,
  },
});
