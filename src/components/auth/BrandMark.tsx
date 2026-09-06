import React from 'react';
import { Image, type ColorValue } from 'react-native';

/**
 * The lockup's drawn size, in dp — one number, three screens.
 *
 * 86 is set by the wordmark rather than by the cart. In the source artwork the
 * words are 83px of a 744px-tall lockup, so at 86dp their caps come out at
 * 9.6dp: about a 13px font, which is the point where "HASHMI MART" stops being
 * a blue smudge under the cart and starts being readable. The old 38dp hero mark
 * gave those caps 3.5dp — present, but not legible, and legible is the whole
 * reason to make this bigger.
 *
 * The width is not free: the rasters are cut at exactly these numbers, so
 * changing one without recutting them is a resample on device.
 */
export const MARK_H = 86;
export const MARK_W = 97;

/**
 * The Hashmi Mart lockup, drawn at one size everywhere it appears in auth.
 *
 * Its own file so Login, Sign Up and Complete Profile cannot drift apart on it,
 * and so the size lives next to the note explaining why it is what it is.
 */
export default function BrandMark({ tintColor }: { tintColor?: ColorValue }) {
  return (
    <Image
      source={require('../../assets/images/logo-mark.png')}
      style={{
        width: MARK_W,
        height: MARK_H,
        resizeMode: 'contain',
        tintColor,
      }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Hashmi Mart"
    />
  );
}
