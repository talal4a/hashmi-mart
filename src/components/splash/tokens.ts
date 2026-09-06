/**
 * Splash-only tokens.
 *
 * The field is Onboarding's `c.cyanDeep`, not the pale auth `#ecfeff`: the
 * splash hands off to Onboarding, and matching the *next* screen is what stops
 * launch reading as two unrelated screens.
 *
 * Keep SPLASH_BG in sync with android/app/src/main/res/values/colors.xml, and
 * with the stencil colour baked into assets/images/splash/mark-stencil.png —
 * that asset only disappears against the field if the two match exactly.
 */
export const SPLASH_BG = '#00A2D4';

/** Where the field lands during the hand-off, per destination. Onboarding is
 *  already this colour, so that reveal is invisible by design; Home is
 *  off-white and Complete Profile is the pale auth cyan, so both wipe the field
 *  away. Every SplashTarget needs a key here or the reveal renders undefined. */
export const EXIT_BG = {
  Onboarding: SPLASH_BG,
  Home: '#F8F9FA',
  CompleteProfile: '#ecfeff',
} as const;

/**
 * Geometry, in the source pixels of logo.png.
 *
 * The mark and the wordmark are cropped from one shared horizontal span so
 * their designed alignment survives being split into two files — which is why
 * both are laid out at the same width, and every other dimension is derived
 * rather than eyeballed. `gap` is the 60px transparent band that made the split
 * possible in the first place.
 */
const SRC = { span: 839, mark: 601, gap: 60, word: 83 };

/**
 * Layout width of both logo halves — ~42% of a 400dp screen.
 *
 * Changing this is not a one-line edit. Every splash PNG is generated at exactly
 * the size it gets drawn, for each of the 1x/2x/3x buckets, so that the OS never
 * resamples artwork at draw time — that resampling is what softens edges and
 * shows up as pixel break. Move this number and the assets have to be re-cut
 * from logo.png, and the boxes in parts.ts re-derived, or the mark will be
 * rescaled on the device and the parts will no longer recompose it.
 *
 * At 168dp the mark's 3x asset is 504x360 out of an 839x601 source crop, i.e.
 * still a downscale with headroom to spare. Going much above ~279dp would start
 * upsampling at 3x.
 */
export const LOGO_W = 168;
const k = LOGO_W / SRC.span;
export const MARK_H = Math.round(SRC.mark * k);
export const GAP = Math.round(SRC.gap * k);
export const WORDMARK_H = Math.round(SRC.word * k);

/**
 * Headroom above the mark, in dp, so the roof can descend into place.
 *
 * The mark's box clips (the sheen band has to be able to start and finish
 * outside the silhouette), so the roof cannot travel from outside it. Instead
 * the box is taller than the mark by this much and pulled back up by an equal
 * negative margin, which leaves the lockup laid out exactly as before while
 * giving the roof somewhere to fall from. The slack over ROOF_TRAVEL keeps the
 * roof's soft top edge off the clip boundary at the start of the descent.
 */
export const PAD_TOP = 28;
export const BOX_H = MARK_H + PAD_TOP;
export const ROOF_TRAVEL = 24;

/** Width of the sheen band. It travels from -SHEEN_W to LOGO_W, so it enters
 *  and leaves the mark completely. */
export const SHEEN_W = 138;

/** The mark holds back to this opacity until the sheen has passed, so the light
 *  has somewhere to go. Pure white with nothing to brighten into reads flat. */
export const MARK_DIM = 0.78;

/**
 * Stage timings, ms. The whole sequence lands at 2480ms, just inside the 2650ms
 * gate in useSplashGate — so nothing is ever cut off mid-gesture.
 *
 *     0     cart arrives (box fade + spring)     → 520
 *   240     roof descends and seats              → 800
 *   380     wordmark wipes in                    → 1080
 *   720     shopping pops in, 5 × POP_STAGGER    → 1500
 *  1540     stencil seals over the assembly      → 1630
 *  1660     light crosses, mark polishes up      → 2480
 */
export const ENTER_MS = 520;
export const ROOF_DELAY = 240;
export const ROOF_MS = 560;
export const WIPE_DELAY = 380;
export const WIPE_MS = 700;
export const POP_DELAY = 720;
export const POP_STAGGER = 110;
export const POP_MS = 340;
export const SEAL_DELAY = 1540;
export const SEAL_MS = 90;
export const SHEEN_DELAY = 1660;
export const SHEEN_MS = 820;
export const POLISH_DELAY = 1660;
export const POLISH_MS = 700;
export const EXIT_MS = 380;

/**
 * The two springs on the mark's box, kept here so this file stays the only place
 * the pacing is described.
 *
 * Slowed alongside the timings by dropping stiffness and adding mass while
 * holding the damping ratio near where it was (~0.67 and ~0.60) — that keeps the
 * few percent of overshoot that makes the mark read as arriving rather than
 * being switched on, at about half the previous speed.
 */
export const RISE_SPRING = { damping: 12, stiffness: 62, mass: 1.25 } as const;
export const SETTLE_SPRING = {
  damping: 11,
  stiffness: 66,
  mass: 1.27,
} as const;
/** Where the box's entry scale starts. Entry only — nothing scales on exit. */
export const SETTLE_FROM = 0.965;

/** How each piece of shopping pops: up from POP_RISE dp below its resting place,
 *  with a POP_TILT-degree kick that alternates side to side. Small on purpose —
 *  the pieces are only ~15dp tall, and a bigger tilt reads as clipart. */
export const POP_RISE = 4;
export const POP_TILT = 6;

/** How far the mark travels, in dp. It rises into place and keeps drifting the
 *  same way on the way out; it never scales on exit. */
export const RISE = 10;
export const DRIFT = -8;
