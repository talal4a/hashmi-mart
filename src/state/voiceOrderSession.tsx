import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { File } from 'expo-file-system';
import { SupportError, supportErrorMessage } from '../services/supportService';
import {
  isConfidentlyUnderstood,
  orderConfidence,
  readOrder,
  scanTranscript,
  unresolvedFragments,
  type CatalogMatch,
  type MatchConfidence,
} from '../services/voiceCatalog';
import { parseOrder, transcribeOrder } from '../services/voiceOrder';
import { reportVoiceOrder } from '../services/voiceDiagnostics';
import type { Recording } from '../hooks/useVoiceRecorder';

/**
 * One voice order, from the moment recording stops until the cart is filled.
 *
 * This used to live inside the recorder sheet, and that was the bug. A customer
 * saying something short and fast — "olpers do bread aik" — taps Stop and shuts
 * the sheet in the same second, which is the natural thing to do once you have
 * finished speaking. The recording was written to disk perfectly. Then:
 *
 *   the recorder answered `null` because the component had unmounted
 *   the sheet's close handler called `reset()` on the pipeline state
 *   the pipeline's own mount flag dropped every late `setState`
 *
 * Three independent ways for a good recording to reach nothing, all of them
 * silent: no error, no spinner, no transcript, nothing to retry. The audio sat
 * on the phone with no one holding a reference to it.
 *
 * So the pipeline is not owned by any screen. It is mounted above the navigator
 * and outlives every sheet, modal and route that might show it. The recorder's
 * only job is to produce a file and hand it over; what happens after that is
 * this object's, and closing a piece of UI cannot touch it.
 *
 * The rule that follows from that: **closing is not cancelling**. Only
 * `discard` — which a customer reaches by explicitly abandoning the order —
 * throws anything away.
 */

export type VoiceStage =
  /** Nothing in flight. */
  | 'idle'
  /** Audio accepted, being checked before anything is sent. */
  | 'finalizing'
  | 'transcribing'
  /** The model is reading a sentence the local pass could not finish. */
  | 'understanding'
  | 'matching'
  /** Items found, ready to go to the cart. */
  | 'ready'
  /** Heard nothing, or nothing we sell. The customer says it again. */
  | 'empty'
  | 'error';

export type VoiceOrderState = {
  stage: VoiceStage;
  transcript: string;
  /** Everything heard: matched, unmatched and out of stock alike. */
  matches: CatalogMatch[];
  confidence: MatchConfidence;
  /** Said, and not accounted for by anything. Never silently dropped. */
  unresolved: string[];
  error: string | null;
};

export type VoiceOrderSession = VoiceOrderState & {
  /** Matched and still wanted: the only things that may reach a cart. */
  addable: CatalogMatch[];
  /** The audio, held until the order is done with or explicitly discarded. */
  recording: Recording | null;
  /**
   * Takes ownership of a finished recording and runs the pipeline.
   *
   * Synchronous on purpose. The caller hands over and is free to unmount in
   * the same tick; nothing here reads the caller again.
   */
  accept: (recording: Recording) => void;
  /** Runs the same audio through again. Costs one transcription, not a re-record. */
  retry: () => void;
  /** The only thing that throws work away. Never called by closing a sheet. */
  discard: () => void;
  /** Lets the customer fix a quantity without redoing the order. */
  setQuantity: (index: number, quantity: number) => void;
};

const EMPTY: VoiceOrderState = {
  stage: 'idle',
  transcript: '',
  matches: [],
  confidence: 'low',
  unresolved: [],
  error: null,
};

const VoiceOrderContext = createContext<VoiceOrderSession | null>(null);

export function useVoiceOrderSession(): VoiceOrderSession {
  const value = useContext(VoiceOrderContext);
  if (!value) {
    throw new Error('useVoiceOrderSession must be used inside VoiceOrderProvider');
  }
  return value;
}

/** Smallest file that could contain speech rather than a mis-tap. */
const MIN_AUDIO_BYTES = 900;

export function VoiceOrderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VoiceOrderState>(EMPTY);

  /**
   * Which attempt owns the screen.
   *
   * Recording again supersedes whatever was in flight, so a slow first attempt
   * landing after a fast second one cannot overwrite it. Note what this is
   * *not* keyed on: closing the sheet does not start a new attempt, so it
   * cannot invalidate the one that is running. That distinction is the whole
   * fix — the old code treated the UI going away as the order going away.
   */
  const attempt = useRef(0);
  const audio = useRef<Recording | null>(null);

  const stale = useCallback((id: number) => attempt.current !== id, []);

  /** Where every successful path ends: matches in, stage decided from them. */
  const settle = useCallback(
    (id: number, transcript: string, matches: CatalogMatch[]) => {
      if (attempt.current !== id) return;
      const addable = matches.filter(
        match => match.productId && match.quantity > 0,
      );
      setState({
        stage: addable.length ? 'ready' : 'empty',
        transcript,
        matches,
        confidence: orderConfidence(matches),
        unresolved: unresolvedFragments(transcript, matches),
        error: null,
      });
    },
    [],
  );

  /**
   * The pipeline.
   *
   * Transcribe once, read it locally, and only call a model when the local
   * read left something unexplained. Most orders are a handful of catalogue
   * words and two numbers; asking a model to confirm that costs a second of
   * the customer's time and one request of a small free quota to agree with an
   * answer we already had.
   */
  const run = useCallback(
    async (id: number, recording: Recording) => {
      setState({ ...EMPTY, stage: 'finalizing' });

      // Gathered as the run goes, so a failure halfway still reports what it
      // got that far with — which is usually the half that explains it.
      let bytes = 0;
      let usedModel = false;
      const say = (
        outcome: string,
        transcript = '',
        matches: CatalogMatch[] = [],
        unresolved: string[] = [],
      ) =>
        reportVoiceOrder({
          attempt: id,
          durationMs: recording.durationMs,
          bytes,
          transcript,
          usedModel,
          matches,
          unresolved,
          outcome,
        });

      // Validated by what is on disk, not by how long the button was held. A
      // fast order is a short file, and a duration floor is what makes "bread
      // aik" indistinguishable from a mis-tap.
      try {
        const file = new File(recording.uri);
        bytes = file.size ?? 0;
        if (!file.exists || bytes < MIN_AUDIO_BYTES) {
          say('nothing in the recording');
          if (!stale(id)) setState({ ...EMPTY, stage: 'empty' });
          return;
        }
      } catch {
        say('recording file unreadable');
        if (!stale(id)) setState({ ...EMPTY, stage: 'empty' });
        return;
      }

      if (stale(id)) return;
      setState({ ...EMPTY, stage: 'transcribing' });

      let transcript: string;
      try {
        transcript = await transcribeOrder(recording.uri, recording.mimeType);
      } catch (caught) {
        if (stale(id)) return;
        const kind = caught instanceof SupportError ? caught.kind : 'unavailable';
        say(`transcription failed (${kind})`);
        // The recording is kept. Try again re-sends it rather than asking the
        // customer to say the whole thing over because our upstream blinked.
        setState({ ...EMPTY, stage: 'error', error: supportErrorMessage(kind) });
        return;
      }

      if (stale(id)) return;
      if (!transcript) {
        say('transcript came back empty');
        setState({ ...EMPTY, stage: 'empty' });
        return;
      }

      // The local read, which is free and instant and usually enough.
      setState(current => ({ ...current, stage: 'matching', transcript }));
      const local = scanTranscript(transcript);

      if (isConfidentlyUnderstood(transcript, local)) {
        if (stale(id)) return;
        say('read locally, no model needed', transcript, local, []);
        settle(id, transcript, local);
        return;
      }

      // Something was left over, or a match was a guess. That is the case a
      // model is genuinely better at than a table of aliases.
      if (stale(id)) return;
      setState(current => ({ ...current, stage: 'understanding', transcript }));

      usedModel = true;
      try {
        const parsed = await parseOrder(transcript);
        if (stale(id)) return;
        const merged = readOrder(transcript, parsed.items);
        say('read with the model', transcript, merged, unresolvedFragments(transcript, merged));
        settle(id, transcript, merged);
      } catch (caught) {
        if (stale(id)) return;
        // A dead parse is not a dead order. The words are already here and the
        // catalogue has read them; the local pass stands on its own.
        const kind = caught instanceof SupportError ? caught.kind : 'unavailable';
        if (local.length) {
          say(`model failed (${kind}), local read stands`, transcript, local,
            unresolvedFragments(transcript, local));
          settle(id, transcript, local);
          return;
        }
        say(`model failed (${kind}) and nothing matched locally`, transcript);
        setState({
          ...EMPTY,
          stage: 'empty',
          transcript,
          error: supportErrorMessage(kind),
        });
      }
    },
    [stale, settle],
  );

  const accept = useCallback(
    (recording: Recording) => {
      attempt.current += 1;
      audio.current = recording;
      void run(attempt.current, recording);
    },
    [run],
  );

  const retry = useCallback(() => {
    const recording = audio.current;
    if (!recording) return;
    attempt.current += 1;
    void run(attempt.current, recording);
  }, [run]);

  /**
   * The only path that destroys anything.
   *
   * Invalidates whatever is in flight and lets go of the audio. Deliberately
   * does not delete the file: the recorder wrote it into the app's own cache,
   * and a delete racing a request that is still reading it is the other way to
   * turn a good recording into nothing.
   */
  const discard = useCallback(() => {
    attempt.current += 1;
    audio.current = null;
    setState(EMPTY);
  }, []);

  const setQuantity = useCallback((index: number, quantity: number) => {
    setState(current => ({
      ...current,
      matches: current.matches.map((match, i) =>
        i === index ? { ...match, quantity: Math.max(0, quantity) } : match,
      ),
    }));
  }, []);

  const value = useMemo<VoiceOrderSession>(() => {
    const addable = state.matches.filter(
      match => match.productId && match.quantity > 0,
    );
    return {
      ...state,
      addable,
      recording: audio.current,
      accept,
      retry,
      discard,
      setQuantity,
    };
  }, [state, accept, retry, discard, setQuantity]);

  return (
    <VoiceOrderContext.Provider value={value}>
      {children}
    </VoiceOrderContext.Provider>
  );
}
