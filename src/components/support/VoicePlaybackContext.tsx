import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Playback = {
  activeId: string | null;
  blocked: boolean;
  select: (id: string | null) => void;
  setRecording: (value: boolean) => void;
};
const Context = createContext<Playback | null>(null);

export function VoicePlaybackProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [activeId, select] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  useEffect(() => {
    if (!enabled) {
      select(null);
      setRecording(false);
    }
  }, [enabled]);
  const value = useMemo(
    () => ({
      activeId: enabled && !recording ? activeId : null,
      blocked: !enabled || recording,
      select,
      setRecording,
    }),
    [activeId, enabled, recording],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useVoicePlayback() {
  const value = useContext(Context);
  if (!value) throw new Error('VoicePlaybackProvider is required');
  return value;
}
