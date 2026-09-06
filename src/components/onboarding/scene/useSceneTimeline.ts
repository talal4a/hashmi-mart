/**
 * Time for the mart scene: one 0→1 driver per beat, each carrying its own easing
 * so the wrappers only ever deal in space.
 *
 * A beat is a group, not an object. `fixtures` drives the shelf, the freezer, the
 * baskets and their three shadows; `people` drives both characters, their shadows
 * and the cart's. Sharing one driver is what makes each group rigid — the members
 * cannot drift relative to each other because they are reading the same number,
 * so there is no per-object timing left to get wrong.
 *
 * Two things it deliberately does not do the obvious way:
 *
 * It replays on *focus*, not on mount. The screen stays mounted while the user is
 * off in Login or Signup, so on mount alone, coming back would show a finished,
 * static scene instead of the mart building itself.
 *
 * It waits for `armed`. The scene is ~2,000 vector nodes and the shelf alone is
 * 1,335 path strings to parse; if that lands while something is moving it shows as
 * a stutter mid-gesture. MartScene mounts the artwork invisibly first and only
 * arms the timeline once that has settled, so the cost is paid inside the screen
 * transition and the sequence itself runs on a clear thread.
 *
 * And it stops on blur, which is not decoration — see the cleanup below.
 */
import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import cancelAll from '../../../utils/cancelAll';
import trace from '../../../utils/trace';
import { EASE, T } from './tokens';

type Beat = keyof typeof T;

export type Timeline = Record<Beat, SharedValue<number>>;

/** Whatever `Easing.bezier` hands back — a factory, not a plain (t) => number. */
type Curve = (typeof EASE)[keyof typeof EASE];

const CURVE: Record<Beat, Curve> = {
  room: EASE.rise,
  floor: EASE.rise,
  fixtures: EASE.slide,
  people: EASE.walk,
  title: EASE.copy,
  subtitle: EASE.copy,
  button: EASE.copy,
};

const KEYS = Object.keys(T) as Beat[];

/** When the last beat finishes, measured from focus. Sign in before this and the
 *  reset lands on views that are still moving — the bug, in one number. */
const LAST_MS = Math.max(...KEYS.map(k => T[k].delay + T[k].ms));

export function useSceneTimeline(armed: boolean): Timeline {
  // One hook call per beat, in a fixed order, so the rules of hooks hold.
  const room = useSharedValue(0);
  const floor = useSharedValue(0);
  const fixtures = useSharedValue(0);
  const people = useSharedValue(0);
  const title = useSharedValue(0);
  const subtitle = useSharedValue(0);
  const button = useSharedValue(0);

  const beats = useRef<Timeline>({
    room,
    floor,
    fixtures,
    people,
    title,
    subtitle,
    button,
  }).current;

  useFocusEffect(
    useCallback(() => {
      if (!armed) {
        return;
      }
      for (const k of KEYS) {
        beats[k].value = 0;
        beats[k].value = withDelay(
          T[k].delay,
          withTiming(1, { duration: T[k].ms, easing: CURVE[k] }),
        );
      }
      // Development-only. These two lines are the ones to read in a Logcat dump
      // for the white-screen bug: the gap between this and the cleanup below is
      // how long the beats were live, and LAST_MS says how long they needed. A
      // cleanup that arrives early is a cleanup that did real work. See
      // utils/trace.
      trace('OnboardingScene', `animation started, ${LAST_MS}ms to settle`);

      /**
       * Stop the clock on blur, and note that this fires when Login or Signup is
       * pushed on top — not when the screen unmounts, because it doesn't.
       *
       * That timing is the point. Six SceneLayers and two WalkLayer inner views
       * are Reanimated `Animated.View`s wrapping the artwork's SvgViews, and the
       * longest beat here runs to 2600ms. Sign in inside that window — Google
       * one-tap regularly does — and `navigation.reset()` into Complete Profile
       * deletes all eight while their styles are still changing, so Reanimated is
       * left holding prop updates for tags Fabric has just removed. Complete
       * Profile's own avatars then trigger the flush that reports them: every
       * `RenderableView.draw` calls `VirtualView.setClientRect`, which dispatches
       * an SvgOnLayoutEvent from *inside* `SvgView.onDraw`, and Reanimated answers
       * a UI-thread event during a draw pass with a synchronous prop flush.
       * Hence the SurfaceMountingManager warning, and hence "sometimes": it needs
       * the sign-in to beat the timeline.
       *
       * Cancelling here leaves every beat at rest, so the teardown's last mapper
       * run produces an unchanged style and writes nothing. See utils/cancelAll.
       *
       * Nothing is lost visually: this hook already replays from zero on focus,
       * so a scene abandoned half-built is one the user never sees again anyway.
       */
      return () => {
        cancelAll(KEYS.map(k => beats[k]));
        trace('OnboardingScene', 'animation cleanup, beats cancelled');
      };
    }, [armed, beats]),
  );

  return beats;
}
