/**
 * True once the screen has stopped being busy.
 *
 * For work that has to be done but must not be done *now*: building artwork the
 * user has not asked for yet, so that the moment they ask for it there is nothing
 * to build. Both of the obvious places to put that work are the wrong one —
 * mounting it with the screen makes the screen slower to appear, and mounting it
 * on the tap makes the tap slow — and the dead time between the two is free.
 *
 * `runAfterInteractions` waits out the navigation animation, and the two frames
 * after it let the screen's own first commit reach the glass before anything else
 * is queued behind it.
 *
 * One-shot on purpose. It never returns to false, because what it gates is a
 * mount, and taking that back would only mean paying for it a second time.
 */
import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

export function useIdleReady(): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let raf = 0;
    const handle = InteractionManager.runAfterInteractions(() => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => setIdle(true));
      });
    });
    return () => {
      handle.cancel();
      cancelAnimationFrame(raf);
    };
  }, []);

  return idle;
}
