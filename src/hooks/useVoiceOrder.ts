import { useCallback, useRef, useState } from 'react';
import { SupportError, supportErrorMessage } from '../services/supportService';
import {
  matchOrder,
  orderConfidence,
  type CatalogMatch,
  type MatchConfidence,
} from '../services/voiceCatalog';
import {
  newVoiceOrderId,
  parseOrder,
  submitVoiceOrder,
  transcribeOrder,
  uploadVoiceRecording,
} from '../services/voiceOrder';
import type { Recording } from './useVoiceRecorder';

/**
 * One voice order, from the moment recording stops.
 *
 * The stages are separate states rather than booleans because the customer is
 * shown a different thing at each one, and because a failure at any stage has
 * to leave the recording intact and sendable. That is the whole hybrid: AI is
 * the convenience layer, the recording is the safety layer, and the safety
 * layer must never be reachable only *through* the convenience one.
 *
 * So `sendToStore` does not depend on anything the AI produced. It works from a
 * transcript, from an empty parse, from a Groq outage, and from a transcription
 * that never ran.
 */

export type VoiceStage =
  | 'idle'
  | 'transcribing'
  | 'understanding'
  | 'review'
  | 'sending'
  | 'sent'
  | 'error';

export type VoiceOrderState = {
  stage: VoiceStage;
  transcript: string;
  matches: CatalogMatch[];
  confidence: MatchConfidence;
  /** Reference the customer can quote. Present once the store has it. */
  reference: string | null;
  error: string | null;
};

const EMPTY: VoiceOrderState = {
  stage: 'idle',
  transcript: '',
  matches: [],
  confidence: 'low',
  reference: null,
  error: null,
};

export default function useVoiceOrder() {
  const [state, setState] = useState<VoiceOrderState>(EMPTY);
  const recording = useRef<Recording | null>(null);
  const mounted = useRef(true);

  const reset = useCallback(() => {
    recording.current = null;
    setState(EMPTY);
  }, []);

  /**
   * Runs the AI over a finished recording.
   *
   * Every failure lands in the same place: the recording is held, the error is
   * friendly, and the sheet still offers to send the original. A Groq quota
   * exhausted mid-order is not an ordering failure — it is the moment the
   * fallback exists for.
   */
  const interpret = useCallback(async (result: Recording) => {
    recording.current = result;
    setState({ ...EMPTY, stage: 'transcribing' });

    let transcript = '';
    try {
      transcript = await transcribeOrder(result.uri, result.mimeType);
    } catch (caught) {
      const kind = caught instanceof SupportError ? caught.kind : 'unavailable';
      if (!mounted.current) return;
      setState({
        ...EMPTY,
        stage: 'review',
        error: supportErrorMessage(kind),
      });
      return;
    }

    if (!mounted.current) return;
    if (!transcript) {
      // Silence, or nothing recognisable. Not a failure to paper over: the
      // sheet says so and offers a re-record or sending the audio as-is.
      setState({ ...EMPTY, stage: 'review', transcript: '' });
      return;
    }

    setState(current => ({ ...current, stage: 'understanding', transcript }));

    try {
      const parsed = await parseOrder(transcript);
      if (!mounted.current) return;
      const matches = matchOrder(parsed.items);
      setState({
        stage: 'review',
        transcript,
        matches,
        confidence: orderConfidence(matches),
        reference: null,
        error: null,
      });
    } catch (caught) {
      const kind = caught instanceof SupportError ? caught.kind : 'unavailable';
      if (!mounted.current) return;
      // The transcript survives a failed parse, which is the point of doing
      // them separately: the customer can still see what was heard.
      setState({
        ...EMPTY,
        stage: 'review',
        transcript,
        error: supportErrorMessage(kind),
      });
    }
  }, []);

  /** Lets the customer fix a quantity without redoing the order. */
  const setQuantity = useCallback((index: number, quantity: number) => {
    setState(current => ({
      ...current,
      matches: current.matches.map((match, i) =>
        i === index ? { ...match, quantity: Math.max(0, quantity) } : match,
      ),
    }));
  }, []);

  /**
   * Sends the original recording to the store.
   *
   * Deliberately independent of everything above. Whatever the AI managed is
   * attached if it exists, because it helps whoever picks the order — but its
   * absence changes nothing about whether this works.
   */
  const sendToStore = useCallback(async () => {
    const result = recording.current;
    if (!result) return;

    setState(current => ({ ...current, stage: 'sending', error: null }));

    try {
      const id = newVoiceOrderId();
      const audio = await uploadVoiceRecording(id, result.uri);
      const created = await submitVoiceOrder({
        audio,
        durationMs: result.durationMs,
        transcript: state.transcript || undefined,
        matches: state.matches.length ? state.matches : undefined,
        aiConfidence: state.matches.length ? state.confidence : undefined,
      });
      if (!mounted.current) return;
      setState(current => ({
        ...current,
        stage: 'sent',
        reference: created.id,
      }));
    } catch (caught) {
      const kind = caught instanceof SupportError ? caught.kind : 'unavailable';
      if (!mounted.current) return;
      // The recording is still held, so Try again resends rather than
      // re-records. Losing an upload must never cost the customer their words.
      setState(current => ({
        ...current,
        stage: 'review',
        error: supportErrorMessage(kind),
      }));
    }
  }, [state.transcript, state.matches, state.confidence]);

  /** Items safe to add to the cart: matched, and still wanted. */
  const addable = state.matches.filter(
    match => match.productId && match.quantity > 0,
  );

  return {
    ...state,
    addable,
    hasRecording: recording.current !== null,
    interpret,
    setQuantity,
    sendToStore,
    reset,
    /** Called on unmount so a late response cannot set state on a dead sheet. */
    dispose: () => {
      mounted.current = false;
    },
  };
}
