import * as Haptics from 'expo-haptics';

/**
 * The three moments this app is allowed to buzz.
 *
 * PRD section 15 is specific about it: send, recording start, and handoff
 * selection. It is worth having a file for because the failure mode of haptics
 * is not a crash — it is an app that vibrates on every token of a streaming
 * reply and feels broken. Naming the occasions rather than exposing
 * `impactAsync` is what keeps that from being one careless call away.
 *
 * Every call is fire-and-forget. Haptics are unavailable on some Android
 * hardware and inside the simulator, and a rejected promise there must never
 * become an unhandled rejection in a chat send path.
 */

function fire(run: () => Promise<void>) {
  run().catch(() => {});
}

/** A message left the composer. */
export function tapSend() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** The microphone opened. Slightly firmer, because it starts something. */
export function tapRecordStart() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** The user chose to bring in a human. */
export function tapHandoff() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** A recording was thrown away. */
export function tapCancel() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
