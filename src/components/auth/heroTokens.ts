/**
 * The dark band at the top of Login and Sign Up, in numbers.
 *
 * Shared because the band's own gradient and the status bar behind it have to
 * agree: the bar sits inside the band, so a colour defined twice is a visible
 * seam on Android the first time one of them changes.
 */

/** Ink at the top, deepening to brand teal under the card. Tuple, not array,
 *  because expo-linear-gradient's `colors` requires at least two entries at the
 *  type level. */
export const HERO_COLORS = ['#0B2027', '#0d3f4a', '#0e7490'] as const;

export const HERO_LOCATIONS = [0, 0.62, 1] as const;

/** The stop the status bar sits in, so the two can't drift apart. */
export const HERO_TOP = HERO_COLORS[0];

/**
 * How far the card is pulled up into the band, in dp.
 *
 * The band pays for it in bottom padding, so the overlap eats dead gradient
 * rather than the subtitle. 28 is enough for the card's 32dp top radius to read
 * as sitting *in* the band rather than below it — the whole point of the
 * reference composition — while still leaving the teal stop visible at the
 * card's shoulders.
 */
export const CARD_LIFT = 28;

/** The card's top corners on a banded screen — larger than its own 24 so the
 *  shoulders curve away from the band instead of stopping against it. */
export const CARD_TOP_RADIUS = 32;

/** Half of ThemedButton's 56dp height: the primary action reads as a pill on
 *  these two screens, and only these two. */
export const PILL_RADIUS = 28;
