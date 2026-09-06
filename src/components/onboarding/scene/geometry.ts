/**
 * Scene coordinates → screen coordinates.
 *
 * The slot is wider than the scene square on purpose: the man and the woman both
 * start outside the square, and clipping them at the slot edge is what makes them
 * walk in from off-screen instead of appearing at a boundary.
 */
import type { ArtBox } from './art/boxes';
import { SCENE_FILL } from './tokens';

export type Layout = {
  /** viewBox units → dp. */
  k: number;
  /** Top-left of the scene square inside the slot, dp. */
  x: number;
  y: number;
  size: number;
};

export function layout(slotW: number, slotH: number): Layout {
  const size = Math.min(slotW * SCENE_FILL, slotH);
  return {
    k: size / 500,
    x: (slotW - size) / 2,
    y: (slotH - size) / 2,
    size,
  };
}

/**
 * Absolute position of one layer, at its home location.
 *
 * The layer's own box is what makes its transform origin its own centre — a
 * full-size layer would scale and rotate about the centre of the whole
 * illustration instead, which is the mistake that made the splash parts pop
 * about the wrong point.
 */
export function place(box: ArtBox, l: Layout) {
  return {
    position: 'absolute' as const,
    left: l.x + box.x * l.k,
    top: l.y + box.y * l.k,
    width: box.w * l.k,
    height: box.h * l.k,
  };
}
