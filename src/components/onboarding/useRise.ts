/**
 * How copy and controls arrive: a short drift up, fading in.
 *
 * One helper for both so the headline and the button are provably the same gesture
 * at different times, and so neither of them scales. Scaling text is the tell that
 * an intro was animated by a tool rather than composed — and on the way out it is
 * worse, which is why nothing in this app scales on exit either.
 *
 * The beat's easing is already baked into `progress` by the timeline, so this maps
 * it straight through instead of easing it a second time.
 */
import { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/** @param dy how far below its home position the element starts, dp. */
export function useRise(progress: SharedValue<number>, dy = 18) {
  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * dy }],
  }));
}
