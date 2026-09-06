/**
 * When the artwork has finished mounting.
 *
 * The scene is around 2,000 vector nodes, and creating them is a one-off cost
 * that has to be paid *somewhere*. Paying it inside the screen transition, before
 * anything is moving, is invisible; paying it while the shelf is sliding is a
 * visible stutter. So the layers mount hidden, this reports back once the work has
 * drained, and only then does the sequence start.
 *
 * Re-arms on blur so returning to the screen replays from a clean state.
 */
import { useCallback, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

export function useSceneReady(): boolean {
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Two frames, then the queue: the first frame commits the SVG trees, the
      // second gives the UI thread a chance to draw them, and runAfterInteractions
      // waits out the navigation animation itself.
      let raf = 0;
      const handle = InteractionManager.runAfterInteractions(() => {
        raf = requestAnimationFrame(() => {
          raf = requestAnimationFrame(() => setReady(true));
        });
      });
      return () => {
        handle.cancel();
        cancelAnimationFrame(raf);
        setReady(false);
      };
    }, []),
  );

  return ready;
}
