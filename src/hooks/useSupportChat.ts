import { useCallback, useEffect, useRef, useState } from 'react';
import {
  askSupport,
  SupportError,
  supportErrorMessage,
  transcribeVoice,
  type SupportTurn,
} from '../services/supportService';
import type { Recording } from './useVoiceRecorder';
import type { SupportMessage } from '../types/support';

type Live = { content: string; handoff: boolean } | null;
type Attempt = {
  id: string;
  question?: string;
  recording?: Recording;
  history: SupportTurn[];
};
export type SupportChat = ReturnType<typeof useSupportChat>;
let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`;
const historyFrom = (messages: SupportMessage[]): SupportTurn[] =>
  messages
    .filter(m => m.status !== 'error' && m.content.trim())
    .map(({ role, content }) => ({ role, content }));

export default function useSupportChat() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const messageRef = useRef<SupportMessage[]>([]);
  const [live, setLive] = useState<Live>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const mounted = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const lastAttempt = useRef<Attempt | null>(null);
  const attempts = useRef(new Map<string, Attempt>());

  const update = useCallback(
    (fn: (current: SupportMessage[]) => SupportMessage[]) => {
      messageRef.current = fn(messageRef.current);
      if (mounted.current) setMessages(messageRef.current);
    },
    [],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, []);

  // The same operation owns upload, transcription and the assistant response.
  // No network calls inside React state updaters, which React may replay.
  const run = useCallback(
    async (attempt: Attempt, retry = false) => {
      if (!mounted.current || abort.current) return;
      const controller = new AbortController();
      abort.current = controller;
      lastAttempt.current = attempt;
      attempts.current.set(attempt.id, attempt);
      setPending(true);
      setRetrying(retry);
      setError(null);
      const active = () => mounted.current && !controller.signal.aborted;
      try {
        let question = attempt.question;
        if (!question && attempt.recording) {
          update(list =>
            list.map(m =>
              m.id === attempt.id
                ? { ...m, status: 'transcribing', voiceError: undefined }
                : m,
            ),
          );
          question = await transcribeVoice(
            attempt.recording.uri,
            attempt.recording.mimeType,
            controller.signal,
          );
          if (!active()) throw new SupportError('aborted');
          if (!question) throw new SupportError('silent');
          attempt.question = question;
          update(list =>
            list.map(m =>
              m.id === attempt.id
                ? {
                    ...m,
                    content: question!,
                    transcript: question,
                    status: 'sent',
                  }
                : m,
            ),
          );
        }
        if (!question) return;
        update(list =>
          list.map(m =>
            m.id === attempt.id
              ? { ...m, status: 'sent', voiceError: undefined }
              : m,
          ),
        );
        setLive({ content: '', handoff: false });
        const answer = await askSupport(
          question,
          attempt.history,
          delta => {
            if (active())
              setLive(current =>
                current
                  ? { ...current, content: current.content + delta }
                  : current,
              );
          },
          controller.signal,
        );
        if (!active()) return;
        update(list => [
          ...list,
          {
            id: nextId('ai'),
            role: 'assistant',
            content: answer.content,
            handoff: answer.handoff,
            createdAt: Date.now(),
            status: 'complete',
          },
        ]);
        attempts.current.delete(attempt.id);
        lastAttempt.current = null;
      } catch (caught) {
        if (!mounted.current) return;
        const kind =
          caught instanceof SupportError ? caught.kind : 'unavailable';
        const message = supportErrorMessage(kind);
        update(list =>
          list.map(m =>
            m.id === attempt.id
              ? {
                  ...m,
                  status: 'error',
                  voiceError: attempt.recording ? message : undefined,
                }
              : m,
          ),
        );
        setError(message);
      } finally {
        if (abort.current === controller) {
          abort.current = null;
          if (mounted.current) {
            setLive(null);
            setPending(false);
            setRetrying(false);
          }
        }
      }
    },
    [update],
  );

  const send = useCallback(
    (text: string) => {
      const question = text.trim();
      if (!question || abort.current || !mounted.current) return;
      const id = nextId('user');
      const history = historyFrom(messageRef.current);
      update(list => [
        ...list,
        {
          id,
          role: 'user',
          content: question,
          status: 'sent',
          createdAt: Date.now(),
        },
      ]);
      void run({ id, question, history });
    },
    [run, update],
  );

  const sendVoice = useCallback(
    async (recording: Recording) => {
      if (abort.current || !mounted.current) return;
      const id = nextId('voice');
      const history = historyFrom(messageRef.current);
      update(list => [
        ...list,
        {
          id,
          role: 'user',
          content: '',
          status: 'transcribing',
          createdAt: Date.now(),
          audioUri: recording.uri,
          durationMs: recording.durationMs,
        },
      ]);
      await run({ id, recording, history });
    },
    [run, update],
  );

  const retry = useCallback(
    (id?: string) => {
      const attempt = id ? attempts.current.get(id) : lastAttempt.current;
      if (attempt) void run(attempt, true);
    },
    [run],
  );
  const deleteVoice = useCallback(
    (id: string) => {
      if (abort.current) return;
      attempts.current.delete(id);
      if (lastAttempt.current?.id === id) {
        lastAttempt.current = null;
        setError(null);
      }
      // The cache file remains until OS cache cleanup, so disposal of a player
      // cannot race deleting its source. No persistent conversation references it.
      update(list => list.filter(m => m.id !== id));
    },
    [update],
  );
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
    started: messages.length > 0,
    send,
    sendVoice,
    retry,
    deleteVoice,
    stop,
    dismissError,
  };
}
