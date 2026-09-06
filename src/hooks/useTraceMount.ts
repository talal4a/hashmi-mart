import { useEffect } from 'react';
import trace from '../utils/trace';

/**
 * Log when a component mounts and when it goes, in development only.
 *
 * Deliberately an effect with an empty dependency list and no other body: the
 * cleanup here fires at the same point in the commit that Fabric deletes the
 * native views, so the "gone" line is a marker for the exact moment a stale
 * Reanimated write would become unserviceable. Anything else in this hook would
 * move that line.
 *
 * Pair it with the raw `trace` from utils for animation start and cancel, which
 * are not tied to mounting — on Onboarding the timeline stops on *blur* while the
 * screen stays mounted underneath Login, and that difference is the whole bug.
 * See utils/trace for what a healthy sequence looks like.
 */
export default function useTraceMount(label: string): void {
  useEffect(() => {
    trace(label, 'mounted');
    return () => {
      trace(label, 'unmounted');
    };
  }, []);
}
