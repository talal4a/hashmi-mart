import { Easing } from 'react-native-reanimated';

/**
 * Motion for the auth screens, in one place.
 *
 * The curve is deliberately mid-loaded rather than the expo-style
 * `bezier(0.16, 1, 0.3, 1)` these screens used to share. That curve puts ~90% of
 * the distance in the first quarter of its beat and peaks at ~6x its own average
 * speed, which reads as snap-then-hang however long you make the duration — the
 * exact complaint that got the onboarding scene retimed. Scored the same way,
 * this one covers 66% of the distance at the half-beat, spends 79% of the beat
 * visibly moving, and peaks at 1.37x average.
 *
 * `x1 = 0.32` matters as much as the shape: a curve starting at `x1 = 0` leaves
 * at infinite velocity, so it can score well and still look like a cut.
 */
/**
 * The auth curve — **Reanimated only.**
 *
 * `Easing.bezier` here returns an `EasingFunctionFactory`, i.e. `{ factory }`,
 * not a `(t) => number`. Reanimated's `withTiming` unwraps it; RN's own
 * `Animated.timing` calls it, so handing this to one is a TypeError on the first
 * frame — from inside the animation loop, with no component in the stack to name.
 * Files on RN `Animated` (the whole auth and profile furniture, deliberately, to
 * stay clear of the Fabric race) must write `Easing.bezier(0.32, 0.42, 0.68, 1)`
 * from `react-native` instead. Same four numbers, same curve, different module.
 */
export const AUTH_EASE = Easing.bezier(0.32, 0.42, 0.68, 1);

/** Card and section entries. Long enough to read as arriving, not appearing. */
export const ENTER_MS = 380;

/** Error banners and other state swaps, which must not outstay their news. */
export const STATE_MS = 220;

/**
 * Direct feedback: a control moving because a finger just told it to.
 *
 * Shorter than STATE_MS because it is answering a tap rather than reporting a
 * change. 220ms is right for news arriving on its own and too long for a thumb
 * following a thumb — the delay reads as the app thinking about it. This is not
 * the "too fast" failure from the onboarding scene, which was a front-loaded
 * curve on a decorative entrance; AUTH_EASE still spreads the distance evenly,
 * there is simply less of the beat to spread it over.
 */
export const SWITCH_MS = 130;

/**
 * Entry travel, in dp. Small on purpose: with the distance spread across the
 * whole beat, 22dp reads as a settle, while the 30dp these screens used needed
 * a front-loaded curve to not feel slow — which is how the problem started.
 */
export const ENTER_RISE = 22;
