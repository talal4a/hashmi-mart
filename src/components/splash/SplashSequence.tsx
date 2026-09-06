import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  runOnJS,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SplashTarget } from '../../hooks/useSplashGate';
import cancelAll from '../../utils/cancelAll';
import ExitReveal from './ExitReveal';
import LogoMark from './LogoMark';
import LogoWordmark from './LogoWordmark';
import Vignette from './Vignette';
import { EXIT_BG, EXIT_MS, GAP, PAD_TOP, SPLASH_BG } from './tokens';

const EASE_EXIT = Easing.bezier(0.4, 0, 0.2, 1);

type Props = {
  /** Flip to true once the app is ready; the sequence plays its hand-off. */
  exit: boolean;
  /** Where the app is going, which decides the reveal colour. */
  target: SplashTarget;
  /** Called on the JS thread once the hand-off has finished. */
  onExitComplete: () => void;
};

/**
 * The whole splash choreography.
 *
 * The logo assembles rather than appears: the cart arrives, the roof drops onto
 * it, the shopping pops into the basket, and a band of light crosses the finished
 * mark. Each part owns its own entry — see LogoMark for the running order and
 * tokens.ts for the timings — but the exit is one shared driver held here. That is
 * deliberate: a single driver means a single completion callback, so there is
 * exactly one path off this screen no matter how many things are animating.
 *
 * The reveal disc goes on last, over the lockup, so that whatever it has reached
 * is simply the next screen's colour. It is also skipped entirely when the
 * destination already matches the field, which is the Onboarding case: an
 * invisible disc would still erase the mark from its own centre outwards, and a
 * fade is the better gesture when there is no colour change to justify it.
 */
export default function SplashSequence({
  exit,
  target,
  onExitComplete,
}: Props) {
  const leave = useSharedValue(0);
  const reveal = EXIT_BG[target];

  useEffect(() => {
    if (!exit) return;
    leave.value = withTiming(
      1,
      { duration: EXIT_MS, easing: EASE_EXIT },
      // Fires even when interrupted: the caller is idempotent, and a swallowed
      // callback would strand the user on the splash forever.
      () => runOnJS(onExitComplete)(),
    );
    // `leave` is the one value here that is provably live at hand-off time, since
    // reaching 1 is what calls onExitComplete and onExitComplete is what calls
    // navigation.reset(). Four views read it — the vignette, the mark, the
    // wordmark and the reveal disc — so leaving it running into the teardown is
    // four dead tags rather than one. It matters most on the interrupted path,
    // where the callback fires mid-value. See utils/cancelAll.
    return () => {
      cancelAll([leave]);
    };
  }, [exit]);

  return (
    <>
      <Vignette exit={leave} />
      <View style={styles.lockup}>
        <LogoMark exit={leave} />
        <LogoWordmark exit={leave} />
      </View>
      {reveal !== SPLASH_BG && <ExitReveal exit={leave} color={reveal} />}
    </>
  );
}

const styles = StyleSheet.create({
  lockup: {
    alignItems: 'center',
    gap: GAP,
    // The mark's box carries PAD_TOP of headroom above the artwork so the roof
    // has somewhere to fall from. Cancelling it here rather than on the box keeps
    // the lockup centred exactly where it was, and keeps the falling roof inside
    // its parent's bounds — a child painting outside them is the sort of thing
    // that works on one platform and not the other.
    marginTop: -PAD_TOP,
  },
});
