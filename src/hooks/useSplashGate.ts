import { useEffect, useState } from 'react';
import useAuthDestination, { type AuthRoute } from './useAuthDestination';

/**
 * How long the splash is guaranteed to stay up. The sequence in
 * components/splash lands at 2480ms, so this leaves a beat on the settled lockup
 * without ever cutting a gesture off part-way. Anything added to that
 * choreography has to move this number too.
 */
const MIN_VISIBLE_MS = 2650;

export type SplashTarget = AuthRoute;

/**
 * Decides when the splash may hand off, and to where.
 *
 * `ready` needs both conditions. Dropping the resolution half sends a signed-in
 * user to Onboarding, because the session and the profile check both arrive
 * asynchronously. Dropping the timer half makes the splash flicker past on a
 * warm start.
 *
 * The profile read is free in wall-clock terms: it runs inside the 2650ms the
 * splash owes the animation anyway, so routing a returning user past Complete
 * Profile costs nothing at launch.
 */
export default function useSplashGate() {
  const { route, resolving } = useAuthDestination();
  const [minimumElapsed, setMinimumElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  return {
    ready: minimumElapsed && !resolving,
    target: (route ?? 'Onboarding') as SplashTarget,
  };
}
