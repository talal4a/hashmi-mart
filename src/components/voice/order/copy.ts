import type { SupportFailure } from '../../../services/supportService';
import type { CatalogMatch } from '../../../services/voiceCatalog';

/**
 * What the voice sheet says, decided in one place.
 *
 * Every branch here answers the same three questions in the same order: what
 * happened, why it might have happened, and the one thing that fixes it. That
 * is the whole rule. "Something went wrong" fails it, and so does a friendly
 * sentence with no way out of it — a customer holding a recording of their
 * grocery list needs to know whether to speak again, wait, or carry on.
 *
 * The second rule is the language. Short words, short sentences, one idea per
 * sentence, and the action named the way it is written on the button. Nobody
 * shopping for tomatoes should have to parse a clause, and for most people
 * here English is the second or third language on the phone. If a sentence
 * cannot survive being read out loud by someone in a hurry, it is wrong.
 *
 * It is a pure function so the wording can be tested without a renderer, and
 * so the sheet cannot grow a second opinion about what to say in a corner it
 * only reaches on a bad network.
 */

export type VoiceTone = 'found' | 'ask' | 'shelf' | 'repair' | 'blocked';

/** The repair offered first. The panel decides how to draw it. */
export type VoiceAction = 'add' | 'record' | 'retry' | 'settings';

/**
 * Named here rather than chosen in the view, so the picture and the sentence
 * cannot drift apart — a crossed-out microphone over "you are offline" is a
 * small lie that costs a customer a second of confusion every time.
 */
export type VoiceIcon =
  | 'check'
  | 'ear'
  | 'store'
  | 'mic-off'
  | 'wifi-off'
  | 'clock'
  | 'redo'
  | 'settings';

export type VoiceOutcome = {
  tone: VoiceTone;
  icon: VoiceIcon;
  title: string;
  body: string;
  /**
   * A sentence to copy. Only present when *how* it was said is the thing to
   * change; telling someone to "speak clearly" is not advice, giving them a
   * line that works is.
   */
  example?: string;
  action: VoiceAction;
};

export type VoiceOutcomeInput = {
  /** Microphone permission was refused. */
  denied: boolean;
  /** The recorder itself failed — hardware, or another app holding the mic. */
  micFailed: boolean;
  /** The clip was too short to contain an order. */
  tooShort: boolean;
  /** What the pipeline reported, when it reported anything. */
  failure: SupportFailure | null;
  transcript: string;
  matches: CatalogMatch[];
  /** Matched, wanted, and certain — the ones that can go in the cart. */
  addable: CatalogMatch[];
  /** A stocked product is still waiting for the customer's yes. */
  pending: boolean;
};

/** Said the way people here say it, in the order a list usually comes out. */
export const EXAMPLE_PHRASES = [
  'Do kilo tamatar aur ek darjan anday',
  'Aik packet doodh, thora sa palak',
] as const;

const plural = (n: number) => (n === 1 ? 'item' : 'items');

export function describeVoiceOutcome(input: VoiceOutcomeInput): VoiceOutcome {
  const {
    denied,
    micFailed,
    tooShort,
    failure,
    transcript,
    matches,
    addable,
    pending,
  } = input;

  // Nothing was ever recorded. These come first because no amount of copy
  // about the list matters while the microphone is shut.
  if (denied)
    return {
      tone: 'blocked',
      icon: 'settings',
      title: 'Turn on the mic',
      body: 'We need your mic to hear you. Turn it on in Settings, then come back here.',
      action: 'settings',
    };

  if (micFailed)
    return {
      tone: 'blocked',
      icon: 'mic-off',
      title: 'The mic stopped',
      body: 'A call or another app may be using it. Close that app, then record again.',
      action: 'record',
    };

  if (tooShort)
    return {
      tone: 'repair',
      icon: 'redo',
      title: 'That was too short',
      body: 'We got nothing. Say your full list first. Then tap the red Stop button.',
      example: EXAMPLE_PHRASES[0],
      action: 'record',
    };

  // Something was understood. Say what, and get on with it.
  if (addable.length > 0)
    return pending
      ? {
          tone: 'ask',
          icon: 'ear',
          title: 'Almost done',
          body: 'One item is a guess. Tap Add if it is right. Or just wait, and we will keep it in your voice note.',
          action: 'add',
        }
      : {
          tone: 'found',
          icon: 'check',
          title: 'We found your items',
          body: `${addable.length} ${plural(addable.length)} going in your cart.`,
          action: 'add',
        };

  if (pending)
    return {
      tone: 'ask',
      icon: 'ear',
      title: 'Did we get this right?',
      body: 'This is the closest item we have. Tap Add if it is right. If not, say it again.',
      action: 'add',
    };

  // Nothing usable came back. Which of these it is decides what to offer, and
  // "try again" is only honest when trying again is what helps.
  if (failure === 'offline')
    return {
      tone: 'repair',
      icon: 'wifi-off',
      title: 'No internet',
      body: 'Your recording is safe on your phone. Turn on the internet, then tap Try again. You do not have to speak again.',
      action: 'retry',
    };

  if (failure === 'busy' || failure === 'timeout')
    return {
      tone: 'repair',
      icon: 'clock',
      title: 'This is taking too long',
      body: 'Our service is busy right now. Wait a moment, then tap Try again. You do not have to speak again.',
      action: 'retry',
    };

  if (failure === 'unauthenticated')
    return {
      tone: 'blocked',
      icon: 'settings',
      title: 'Please sign in again',
      body: 'You have been signed out. Sign in again. Your recording will still be here.',
      action: 'retry',
    };

  if (failure === 'silent' || !transcript)
    return {
      tone: 'repair',
      icon: 'mic-off',
      title: 'We did not hear anything',
      body: 'The recording is empty. Check nothing is covering the mic. Then say your list out loud.',
      example: EXAMPLE_PHRASES[0],
      action: 'record',
    };

  if (failure === 'invalid-audio' || failure === 'missing-file')
    return {
      tone: 'repair',
      icon: 'redo',
      title: 'The recording is broken',
      body: 'We could not open it. Please record again. It only takes a few seconds.',
      action: 'record',
    };

  // A transcript exists, so speaking again is not obviously the fix — the
  // service is what fell over, and the words are still on screen.
  if (failure)
    return {
      tone: 'repair',
      icon: 'clock',
      title: 'We heard you, but we got stuck',
      body: 'Your words are below. Tap Try again. Or take your voice note to checkout as it is.',
      action: 'retry',
    };

  const unstocked = matches
    .map(match => match.unstocked)
    .filter((name): name is string => Boolean(name));
  if (matches.length > 0 && unstocked.length === matches.length)
    return {
      tone: 'shelf',
      icon: 'store',
      title: 'Not on our shelves yet',
      body:
        unstocked.length === 1
          ? `We do not sell ${unstocked[0]} yet. You can order anything else.`
          : 'We do not sell these yet. You can order anything else.',
      action: 'record',
    };

  // Heard clearly, matched nothing. The repair is naming the items plainly,
  // so the example is a bare list rather than a sentence.
  return {
    tone: 'repair',
    icon: 'ear',
    title: 'We could not find those items',
    body: 'We heard you. But we do not sell those. Try again with just the item names.',
    example: 'Tamatar, kela, doodh',
    action: 'record',
  };
}
