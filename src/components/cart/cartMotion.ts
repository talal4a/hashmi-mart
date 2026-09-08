export const FLIGHT_DURATION = 620;
export const FLIGHT_SIZE = 48;
export const MAX_CART_FLIGHTS = 2;
export const RECEIVE_AT = 0.8;

export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };

export function validRect(rect: Rect) {
  return (
    Object.values(rect).every(Number.isFinite) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

/** All measurements use the same native window, then become overlay-local. */
export function flightEndpoints(source: Rect, basket: Rect, overlay: Rect) {
  if (![source, basket, overlay].every(validRect)) return null;
  const start = {
    x: source.x + source.width / 2 - overlay.x,
    y: source.y + source.height / 2 - overlay.y,
  };
  const end = {
    x: basket.x + basket.width / 2 - overlay.x,
    y: basket.y + basket.height / 2 - overlay.y,
  };
  // Virtualized/offscreen products and hidden targets must never launch a flight.
  if (
    [start, end].some(
      p => p.x < 0 || p.y < 0 || p.x > overlay.width || p.y > overlay.height,
    )
  )
    return null;
  return { start, end };
}

export function sampleFlight(progress: number, start: Point, end: Point) {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  const u = 1 - t;
  const arcY =
    Math.min(start.y, end.y) -
    Math.min(110, Math.abs(end.y - start.y) * 0.2 + 40);
  const entry = Math.max(0, (t - RECEIVE_AT) / (1 - RECEIVE_AT));
  return {
    x: u * u * start.x + 2 * u * t * ((start.x + end.x) / 2) + t * t * end.x,
    y: u * u * start.y + 2 * u * t * arcY + t * t * end.y,
    scale: (1 - 0.35 * t) * (1 - 0.92 * entry),
    opacity: 1 - entry,
  };
}
