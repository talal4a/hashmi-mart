import { useCallback, useEffect, useRef, useState } from 'react';
import {
  askSupport,
  SupportError,
  supportErrorMessage,
  transcribeVoice,
  type SupportTurn,
} from '../services/supportService';
import { readAsBase64, type Recording } from './useVoiceRecorder';
import type { SupportMessage } from '../types/support';

/**
 * The conversation, and everything that can go wrong in it.
 *
 * Local state rather than a global store, on purpose. PRD section 12.2 asks for
 * exactly this until there is a real need for more, and the need would be
 * persistence — which this deliberately does not do yet. What it does do is keep
 * the message shape Firestore-compatible, so the day a `conversations/{id}`
 * collection appears, this hook writes to it and nothing above it changes.
 *
 * The invariant worth stating: the user's message is never removed by a failure.
 * A support question typed in Urdu on a bad connection is not something to make
 * somebody type twice, so a failed turn leaves the question in place and hangs
 * an error beside it that retries the *same* question.
 */

/** A running assistant turn, kept out of `messages` until it settles. */
type Live = { content: string; handoff: boolean } | null;

export type SupportChat = ReturnType<typeof useSupportChat>;

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export default function useSupportChat() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [live, setLive] = useState<Live>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const abort = useRef<AbortController | null>(null);
  /** The question a retry would resend. Cleared once a turn completes. */
  const lastQuestion = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, []);

  /**
   * The turns the backend sees.
   *
   * Read from the messages array rather than accumulated separately, so history
   * cannot drift from what is on screen — a mismatch there is how an assistant
   * ends up answering a question the user can no longer see. Failed turns and
   * un-transcribed voice notes are excluded: neither is something the model
   * could have replied to.
   */
  const historyFrom = useCallback((list: SupportMessage[]): SupportTurn[] => {
    return list
      .filter(m => m.status !== 'error' && m.content.trim().length > 0)
      .map(m => ({ role: m.role, content: m.content }));
  }, []);

  /**
   * Runs one assistant turn against the given question.
   *
   * `history` is captured from the caller's snapshot rather than read here, so
   * that a retry replays the conversation as it was *before* the failed attempt
   * rather than including it.
   */
  const run = useCallback(
    async (question: string, history: SupportTurn[]) => {
      const controller = new AbortController();
      abort.current = controller;
      lastQuestion.current = question;

      setPending(true);
      setError(null);
      setRetrying(false);
      setLive({ content: '', handoff: false });

      try {
        const result = await askSupport(
          question,
          history,
          delta => {
            // Streaming updates land here token by token. Only this small object
            // re-renders; the message list above it is untouched.
            if (!mounted.current) return;
            setLive(current =>
              current ? { ...current, content: current.content + delta } : current,
            );
          },
          controller.signal,
        );

        if (!mounted.current) return;
        setMessages(current => [
          ...current,
          {
            id: nextId('ai'),
            role: 'assistant',
            content: result.content,
            createdAt: Date.now(),
            status: 'complete',
            handoff: result.handoff,
          },
        ]);
        lastQuestion.current = null;
      } catch (caught) {
        if (!mounted.current) return;
        const kind = caught instanceof SupportError ? caught.kind : 'unavailable';
        // A stop the user asked for is not a failure, and must not offer a
        // WhatsApp escalation as though something broke.
        setError(supportErrorMessage(kind));
        if (kind === 'aborted') lastQuestion.current = null;
      } finally {
        if (mounted.current) {
          setLive(null);
          setPending(false);
        }
        abort.current = null;
      }
    },
    [],
  );

  /** Sends a typed message or a quick action. */
  const send = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || pending) return;
      const message: SupportMessage = {
        id: nextId('user'),
        role: 'user',
        content: value,
        createdAt: Date.now(),
        status: 'sent',
      };
      setMessages(current => {
        void run(value, historyFrom(current));
        return [...current, message];
      });
    },
    [pending, run, historyFrom],
  );

  /**
   * Sends a recording: the card appears immediately, the words fill in after.
   *
   * The order matters. Uploading first and rendering on success would leave the
   * user watching an empty conversation for the length of a round trip, having
   * just done something they know worked. So the voice card lands at once with a
   * `transcribing` status, and the transcript is written into it in place.
   */
  const sendVoice = useCallback(
    async (recording: Recording) => {
      if (pending) return;
      const id = nextId('voice');
      setMessages(current => [
        ...current,
        {
          id,
          role: 'user',
          content: '',
          createdAt: Date.now(),
          status: 'transcribing',
          audioUri: recording.uri,
          durationMs: recording.durationMs,
        },
      ]);
      setPending(true);
      setError(null);

      try {
        const base64 = await readAsBase64(recording.uri);
        const transcript = await transcribeVoice(base64, recording.mimeType);
        if (!mounted.current) return;

        if (!transcript) {
          // Silence, not a failure. Section 14 forbids inventing a transcript,
          // so the honest move is to say nothing was heard and let them retry.
          setMessages(current =>
            current.map(m => (m.id === id ? { ...m, status: 'error' } : m)),
          );
          setError("Hashmi AI couldn't hear anything in that recording.");
          setPending(false);
          return;
        }

        let history: SupportTurn[] = [];
        setMessages(current => {
          const updated = current.map(m =>
            m.id === id
              ? { ...m, content: transcript, transcript, status: 'sent' as const }
              : m,
          );
          // The turn before this one, which is what the model needs as context.
          history = historyFrom(updated.filter(m => m.id !== id));
          return updated;
        });
        setPending(false);
        await run(transcript, history);
      } catch (caught) {
        if (!mounted.current) return;
        const kind = caught instanceof SupportError ? caught.kind : 'unavailable';
        // The recording itself is kept. Section 14 asks for that explicitly —
        // re-recording a question you already asked is the worst possible
        // response to a failed upload.
        setMessages(current =>
          current.map(m => (m.id === id ? { ...m, status: 'error' } : m)),
        );
        setError(supportErrorMessage(kind));
        setPending(false);
      }
    },
    [pending, run, historyFrom],
  );

  /** Re-asks the last question. The failed attempt leaves no trace. */
  const retry = useCallback(() => {
    const question = lastQuestion.current;
    if (!question || pending) return;
    setRetrying(true);
    // One frame of the error's morph-back before the dots return, so section
    // 8.7's transition has something to play rather than being cut short.
    setTimeout(() => {
      setMessages(current => {
        void run(question, historyFrom(current));
        return current;
      });
    }, 200);
  }, [pending, run, historyFrom]);

  /** Stops generation. The partial answer is discarded rather than kept. */
  const stop = useCallback(() => {
    abort.current?.abort();
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return {
    messages,
    live,
    pending,
    error,
    retrying,
    /** True once the user has said anything; hides the greeting's quick actions. */
    started: messages.length > 0,
    send,
    sendVoice,
    retry,
    stop,
    dismissError,
  };
}
