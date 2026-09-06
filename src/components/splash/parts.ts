import type { ImageSourcePropType } from 'react-native';

/**
 * Where each piece of the mark sits inside the LOGO_W × MARK_H box, in dp.
 *
 * The mark in logo.png is eight disjoint shapes — the cart, the roof, and six
 * pieces of shopping on the basket rail, one of which is the little label
 * floating above the yellow box. So roof, cart and shopping are separable
 * straight from the raster; the vector source that seemed necessary for this
 * never was.
 *
 * Every part is cut from the *same* downscale of the shared crop and placed back
 * at its own integer offset, so at rest the layers recompose the original mark
 * to within 4/255 of alpha on 24 pixels at 1x, 1/255 at 2x, and exactly at 3x.
 * Two consequences worth keeping in mind when editing:
 *
 *  - The boxes are tight to each part, which is the point: a layer scaled about
 *    its own centre pops in place, where a full-size layer would pop about the
 *    centre of the whole mark.
 *  - `y` is measured from the top of the mark, not the top of the mark's box.
 *    LogoMark adds PAD_TOP. Keep it that way — this file describes the artwork,
 *    not the animation's headroom.
 *
 * These boxes are derived from the source pixels at LOGO_W = 168 by the splitter
 * in the session notes. Don't hand-tune them, and don't scale them arithmetically
 * if LOGO_W changes — re-run the splitter, because the boxes are the union of
 * each part's tight box at 1x, 2x and 3x and rounding does not commute with that.
 */
export type PartBox = { x: number; y: number; w: number; h: number };

export const CART: PartBox = { x: 10, y: 22, w: 125, h: 98 };
export const ROOF: PartBox = { x: 43, y: 0, w: 112, h: 52 };

/** Left to right, which is also the order they pop in and the direction the
 *  wordmark wipes and the light travels. */
export const ITEMS: { box: PartBox; source: ImageSourcePropType }[] = [
  {
    box: { x: 19, y: 34, w: 18, h: 18 },
    source: require('../../assets/images/splash/item-1.png'),
  },
  {
    box: { x: 56, y: 31, w: 23, h: 19 },
    source: require('../../assets/images/splash/item-2.png'),
  },
  {
    box: { x: 76, y: 25, w: 21, h: 25 },
    source: require('../../assets/images/splash/item-3.png'),
  },
  {
    box: { x: 91, y: 30, w: 16, h: 20 },
    source: require('../../assets/images/splash/item-4.png'),
  },
  {
    box: { x: 103, y: 35, w: 21, h: 15 },
    source: require('../../assets/images/splash/item-5.png'),
  },
];
