export type ChatRole = 'user' | 'assistant';

/**
 * Where a message is in its life.
 *
 * `sending` and `streaming` are visible states, not bookkeeping: the composer
 * shows a Stop control during the second one, and a message that dies mid-flight
 * has to be distinguishable from one that never left, because only the first is
 * worth retrying as-is.
 */
export type MessageStatus =
  'sending' | 'sent' | 'transcribing' | 'streaming' | 'complete' | 'error';

export type SupportMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  status?: MessageStatus;
  /** Local file URI of a recorded note. Present on voice messages only. */
  audioUri?: string;
  /** Recording length, so the card can render before playback is ready. */
  durationMs?: number;
  /** What the backend heard. Shown under the waveform once it arrives. */
  transcript?: string;
  voiceError?: string;
  /** The assistant asked for a human. Renders the WhatsApp handoff card. */
  handoff?: boolean;
};

/** A tap-to-send starter. `prompt` is what the AI actually receives. */
export type QuickAction = {
  id: string;
  label: string;
  prompt: string;
};
