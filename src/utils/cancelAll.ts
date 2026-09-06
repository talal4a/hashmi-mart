import { cancelAnimation, type SharedValue } from 'react-native-reanimated';

/**
 * Stop a group of shared values, so nothing is still moving when their views go.
 *
 * This exists because of one specific Fabric crash-in-the-log:
 *
 *     W Reanimated: synchronouslyUpdateUIProps failed for tag 4854
 *     Caused by: RetryableMountingLayerException:
 *               Unable to find SurfaceMountingManager for tag: [4854]
 *
 * `MountingManager.getSurfaceManagerForView` searches every live surface for the
 * tag and returns null once the view has been deleted, so that message means
 * exactly one thing: Reanimated pushed props at a view Fabric had already
 * removed. Under `navigation.reset()` a whole screen's views are removed in one
 * mount transaction, which is where the window comes from.
 *
 * Why cancelling helps, and why it has to happen *early*. When animations live on
 * the shared values rather than inside the animated style — `sv.value =
 * withTiming(...)`, which is the pattern everywhere in this app — the style
 * updater takes its non-animated branch and only writes props when the computed
 * style actually differs:
 *
 *     if (!shallowEqual(oldValues, newValues) || forceUpdate) {
 *       updateProps(viewDescriptors, newValues, isAnimatedProps);
 *     }
 *
 * A value still in flight yields a different style on its last run, so a write is
 * queued for a view that is being deleted in the same commit. A value already at
 * rest yields an identical style, `shallowEqual` is true, and nothing is queued.
 * Being at rest before the teardown is therefore the whole fix.
 *
 * `useSharedValue` already calls `cancelAnimation` in its own unmount cleanup, so
 * this is not a missing-cleanup patch — that cancel is too late to help. It is
 * `scheduleOnUI`'d, so it lands after the commit that deleted the views, and its
 * mechanism is `sv.value = sv.value`, a write, which is the very thing being
 * avoided. Calling this on *blur*, or at any point before the reset, is what
 * closes the window; calling it on unmount is only belt-and-braces for the values
 * that happened to be at rest anyway.
 *
 * Reanimated logs and swallows the exception rather than rethrowing, so the
 * observable symptom is not a crash but a dropped prop update — a view stranded
 * at its initial style. On the auth screens the initial style is `opacity: 0`
 * over `AUTH_BG` (#ecfeff), which is why the report is "white screen".
 *
 * @see https://docs.swmansion.com/react-native-reanimated/docs/core/cancelAnimation
 */
export default function cancelAll(
  values: readonly SharedValue<number>[],
): void {
  for (const value of values) {
    cancelAnimation(value);
  }
}
