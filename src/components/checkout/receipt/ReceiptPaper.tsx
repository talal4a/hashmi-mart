import { memo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { PAPER_COLOR, PAPER_WIDTH, type ReceiptRow } from './receiptModel';

export type PaperLayout = { rows: ReceiptRow[]; height: number; width: number };
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

/**
 * Builds full paper contour:
 * - Scalloped bottom edge when normal
 * - Serrated teeth when torn
 */
export function buildPaperPath(
  width: number,
  startY: number,
  endY: number,
  isTopTorn = false,
  isBottomTorn = false,
): string {
  let path = '';

  // Top contour
  if (isTopTorn) {
    path += `M 0,${startY}`;
    const teeth = 28;
    const step = width / teeth;
    for (let i = 1; i <= teeth; i++) {
      const toothY = startY + (i % 2 === 0 ? 0 : 2.5);
      path += ` L ${i * step},${toothY}`;
    }
  } else {
    path += `M 0,${startY} L ${width},${startY}`;
  }

  // Right edge
  path += ` L ${width},${endY}`;

  // Bottom contour
  if (isBottomTorn) {
    const teeth = 28;
    const step = width / teeth;
    for (let i = teeth - 1; i >= 0; i--) {
      const toothY = endY + (i % 2 === 0 ? 0 : 2.5);
      path += ` L ${i * step},${toothY}`;
    }
  } else {
    // Authentic thermal roll scalloped circular cuts
    const numScallops = 16;
    const sw = width / numScallops;
    const depth = 4.5;
    for (let i = numScallops - 1; i >= 0; i--) {
      const xEnd = i * sw;
      const xMid = xEnd + sw / 2;
      path += ` Q ${xMid},${endY - depth} ${xEnd},${endY}`;
    }
  }

  path += ' Z';
  return path;
}

/**
 * Builds a jagged, torn boundary polygon for individual tiny pieces.
 */
export function buildPiecePath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  isLeftTorn: boolean,
  isRightTorn: boolean,
  isTopTorn: boolean,
  isBottomTorn: boolean,
  isLastRow: boolean,
): string {
  let path = '';
  const w = endX - startX;
  const h = endY - startY;

  // Top edge
  if (isTopTorn) {
    path += `M ${startX},${startY}`;
    const teeth = 10;
    const step = w / teeth;
    for (let i = 1; i <= teeth; i++) {
      const ty = startY + (i % 2 === 0 ? 0 : 2);
      path += ` L ${startX + i * step},${ty}`;
    }
  } else {
    path += `M ${startX},${startY} L ${endX},${startY}`;
  }

  // Right edge
  if (isRightTorn) {
    const teeth = 8;
    const step = h / teeth;
    for (let i = 1; i <= teeth; i++) {
      const tx = endX - (i % 2 === 0 ? 0 : 2);
      path += ` L ${tx},${startY + i * step}`;
    }
  } else {
    path += ` L ${endX},${endY}`;
  }

  // Bottom edge
  if (isLastRow) {
    const numScallops = 8;
    const sw = w / numScallops;
    const depth = 4;
    for (let i = numScallops - 1; i >= 0; i--) {
      const xe = startX + i * sw;
      const xm = xe + sw / 2;
      path += ` Q ${xm},${endY - depth} ${xe},${endY}`;
    }
  } else if (isBottomTorn) {
    const teeth = 10;
    const step = w / teeth;
    for (let i = teeth - 1; i >= 0; i--) {
      const ty = endY + (i % 2 === 0 ? 0 : 2);
      path += ` L ${startX + i * step},${ty}`;
    }
  } else {
    path += ` L ${startX},${endY}`;
  }

  // Left edge
  if (isLeftTorn) {
    const teeth = 8;
    const step = h / teeth;
    for (let i = teeth - 1; i >= 0; i--) {
      const tx = startX + (i % 2 === 0 ? 0 : 2);
      path += ` L ${tx},${startY + i * step}`;
    }
  } else {
    path += ` L ${startX},${startY}`;
  }

  path += ' Z';
  return path;
}

export const PaperArtwork = memo(function PaperArtwork({
  layout,
  start = 0,
  end = layout.height,
  topTorn = false,
  bottomTorn = false,
}: {
  layout: PaperLayout;
  start?: number;
  end?: number;
  topTorn?: boolean;
  bottomTorn?: boolean;
}) {
  const visibleRows = layout.rows.filter(row => row.y >= start - 24 && row.y <= end + 24);
  const paperPath = buildPaperPath(PAPER_WIDTH, start, end, topTorn, bottomTorn);

  return (
    <Svg width="100%" height="100%" viewBox={`0 ${start} ${PAPER_WIDTH} ${end - start + 4}`}>
      <Path d={paperPath} fill={PAPER_COLOR} stroke="#E2DFD4" strokeWidth={0.8} />

      <G fill="#181B1F" fontFamily={MONO}>
        {visibleRows.map((row, index) => {
          if (row.rule) {
            return (
              <Line
                key={index}
                x1={16}
                x2={PAPER_WIDTH - 16}
                y1={row.y}
                y2={row.y}
                stroke="#889098"
                strokeDasharray="4 3"
                strokeWidth={0.8}
              />
            );
          }

          if (row.barcode) {
            const barY = row.y - 14;
            const barH = 18;
            const patterns = [2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 3, 1, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 3];
            let curX = 36;
            return (
              <G key={index}>
                {patterns.map((w, bi) => {
                  const x = curX;
                  curX += w + 2;
                  return (
                    <Rect
                      key={bi}
                      x={x}
                      y={barY}
                      width={w}
                      height={barH}
                      fill="#22252A"
                    />
                  );
                })}
                <SvgText
                  x={PAPER_WIDTH / 2}
                  y={row.y + 12}
                  fontSize={7.5}
                  fontWeight="400"
                  textAnchor="middle"
                  fill="#5A6068"
                  letterSpacing={2}
                >
                  {`* ${row.text} *`}
                </SvgText>
              </G>
            );
          }

          return (
            <G key={index}>
              <SvgText
                x={row.center ? PAPER_WIDTH / 2 : 18}
                y={row.y}
                fontSize={row.size}
                fontWeight={row.bold ? '700' : '400'}
                textAnchor={row.center ? 'middle' : 'start'}
                letterSpacing={row.center ? 0.3 : 0}
              >
                {row.text}
              </SvgText>
              {row.right ? (
                <SvgText
                  x={PAPER_WIDTH - 18}
                  y={row.y}
                  fontSize={row.size}
                  fontWeight={row.bold ? '700' : '400'}
                  textAnchor="end"
                >
                  {row.right}
                </SvgText>
              ) : null}
            </G>
          );
        })}
      </G>

      {topTorn ? (
        <Path
          d={buildPaperPath(PAPER_WIDTH, start, start + 3, true, false)}
          fill="none"
          stroke="#C8C4B8"
          strokeWidth={0.6}
        />
      ) : null}
    </Svg>
  );
});

/**
 * Individual tiny torn piece of the receipt.
 * Tumbls and spirals in full 3D physics across the screen.
 */
export function ReceiptPiece({
  layout,
  row,
  col,
  totalRows,
  totalCols,
  progress,
  scale,
}: {
  layout: PaperLayout;
  row: number;
  col: number;
  totalRows: number;
  totalCols: number;
  progress: SharedValue<number>;
  scale: number;
}) {
  const colW = PAPER_WIDTH / totalCols;
  const startX = col * colW;
  const endX = (col + 1) * colW;
  const startY = Math.round((row * layout.height) / totalRows);
  const endY = Math.round(((row + 1) * layout.height) / totalRows);
  const pieceHeight = endY - startY;
  const isLastRow = row === totalRows - 1;

  const isLeftTorn = col > 0;
  const isRightTorn = col < totalCols - 1;
  const isTopTorn = true;
  const isBottomTorn = !isLastRow;

  const colDir = col === 0 ? -1 : 1;
  const rowAlt = row % 2 === 0 ? 1 : -0.85;

  const motion = useAnimatedStyle(() => {
    // Staggered trigger from top to bottom
    const startT = row * 0.04 + col * 0.02;
    const endT = 0.44 + row * 0.055 + col * 0.03;
    const p = interpolate(progress.value, [startT, endT], [0, 1], Extrapolation.CLAMP);

    const flutter = Math.sin(p * Math.PI);
    const airWave = Math.sin(p * Math.PI * 1.4);

    return {
      opacity: interpolate(p, [0, 0.7, 1], [1, 1, 0]),
      transform: [
        { perspective: 850 },
        // Lateral spiral burst outward left or right
        { translateX: colDir * (flutter * 68 + p * 58 * (1 + row * 0.08)) },
        // Gravity acceleration downward
        { translateY: p * p * 320 + p * 45 },
        // Dynamic 3D tumbling
        { rotateZ: `${colDir * (p * 115 + flutter * 30 * rowAlt)}deg` },
        { rotateX: `${rowAlt * airWave * 78}deg` },
        { rotateY: `${colDir * (p * 70 + flutter * 20)}deg` },
        // Shrink away
        { scale: 1 - p * 0.36 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.piece,
        {
          left: startX * scale,
          top: startY * scale,
          width: colW * scale,
          height: (pieceHeight + 4) * scale,
        },
        motion,
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`${startX} ${startY} ${colW} ${pieceHeight + 4}`}
      >
        <Path
          d={buildPiecePath(
            startX,
            startY,
            endX,
            endY,
            isLeftTorn,
            isRightTorn,
            isTopTorn,
            isBottomTorn,
            isLastRow,
          )}
          fill={PAPER_COLOR}
          stroke="#E2DFD4"
          strokeWidth={0.8}
        />
        <G fill="#181B1F" fontFamily={MONO}>
          {layout.rows
            .filter(r => r.y >= startY - 20 && r.y <= endY + 20)
            .map((r, i) => {
              if (r.rule) {
                return (
                  <Line
                    key={i}
                    x1={16}
                    x2={PAPER_WIDTH - 16}
                    y1={r.y}
                    y2={r.y}
                    stroke="#889098"
                    strokeDasharray="4 3"
                    strokeWidth={0.8}
                  />
                );
              }
              return (
                <G key={i}>
                  <SvgText
                    x={r.center ? PAPER_WIDTH / 2 : 18}
                    y={r.y}
                    fontSize={r.size}
                    fontWeight={r.bold ? '700' : '400'}
                    textAnchor={r.center ? 'middle' : 'start'}
                  >
                    {r.text}
                  </SvgText>
                  {r.right ? (
                    <SvgText
                      x={PAPER_WIDTH - 18}
                      y={r.y}
                      fontSize={r.size}
                      fontWeight={r.bold ? '700' : '400'}
                      textAnchor="end"
                    >
                      {r.right}
                    </SvgText>
                  ) : null}
                </G>
              );
            })}
        </G>
      </Svg>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  piece: {
    position: 'absolute',
  },
});
