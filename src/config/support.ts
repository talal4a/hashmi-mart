/**
 * The support desk's public details and its opening moves.
 *
 * The number is here rather than inline because it appears in four places — the
 * header, the handoff card, the error fallback and the WhatsApp deep link — and
 * three of them are cosmetic while the fourth has to be exact. Storing the
 * display form and the dialable form separately is what stops someone
 * "tidying" the spaces out of a wa.me URL, or adding them to the label.
 */

/** As the client writes it, and as it appears on the old web support page. */
export const SUPPORT_PHONE_DISPLAY = '0310 4198984';

/** Same number, wa.me form: country code, no plus, no spaces. */
export const SUPPORT_PHONE_E164 = '923104198984';

/** Prefilled so the agent knows where the message came from. PRD section 10. */
export const SUPPORT_WHATSAPP_MESSAGE =
  'Assalam-o-Alaikum, I need help with HashmiMart.';

import type { QuickAction } from '../types/support';

/**
 * The six openers from PRD section 6.2.
 *
 * Labels are English because that is what the client specified for the chips;
 * the prompts underneath are deliberately Roman Urdu, because the prompt is what
 * the model sees and section 5.1 wants it answering in the user's language. A
 * chip tapped by an Urdu speaker should not silently start an English
 * conversation just because the chip's label was English.
 */
export const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: 'track',
    label: 'Track my order',
    prompt: 'Mera order kahan hai? Main track karna chahta hoon.',
  },
  {
    id: 'missing',
    label: 'Missing item',
    prompt: 'Mere order mein aik item missing hai.',
  },
  {
    id: 'payment',
    label: 'Payment problem',
    prompt: 'Payment mein masla ho raha hai.',
  },
  {
    id: 'refund',
    label: 'Refund / replacement',
    prompt: 'Mujhe refund ya replacement chahiye.',
  },
  {
    id: 'address',
    label: 'Change address',
    prompt: 'Main apna delivery address change karna chahta hoon.',
  },
  {
    id: 'human',
    label: 'Talk to support',
    prompt: 'Main kisi insaan se baat karna chahta hoon.',
  },
] as const;
