/**
 * A timestamped mount/animation trace, on in development and gone in release.
 *
 * This exists for one bug: `Unable to find SurfaceMountingManager for tag: [n]`,
 * where a Reanimated prop write lands after Fabric has deleted the view it was
 * meant for. Nothing in that failure is visible in a stack trace — the exception
 * is caught and logged inside Reanimated, and the screen that reports it is not
 * the screen that owns the stale value. What tells you what happened is the
 * *order* of events across two screens, so every line here carries a relative
 * timestamp and the raw output is meant to be read top to bottom.
 *
 * A healthy sign-in looks like this, and the two Onboarding lines are the ones
 * that matter:
 *
 *   [trace +1204ms] OnboardingScene animation started
 *   [trace +3902ms] OnboardingScene animation cleanup   <- blur, beats at rest
 *   [trace +3961ms] CompleteProfile mounted
 *   [trace +3998ms] ProfileAvatar svg mounted
 *
 * A failing one has the cleanup line missing, arriving after the mount, or
 * arriving less than a beat's duration after the start — any of which means a
 * shared value was still moving when `navigation.reset()` deleted its view.
 *
 * Times are milliseconds since this module first loaded, which is a few hundred
 * ms into startup and therefore not wall-clock accurate. That is fine: only the
 * gaps between lines are being read, never the absolute figures.
 */
const T0 = Date.now();

/**
 * Log one lifecycle event.
 *
 * `__DEV__` is a compile-time constant, so the whole call collapses in a release
 * build and the string is never built. Free to leave in place, which is the
 * point — this bug is intermittent, and a trace you have to re-add is a trace
 * you don't have on the run that finally reproduces it.
 */
export function trace(label: string, event: string): void {
  if (!__DEV__) return;
  console.log(`[trace +${Date.now() - T0}ms] ${label} ${event}`);
}

export default trace;
