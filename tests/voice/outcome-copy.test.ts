import {
  describeVoiceOutcome,
  EXAMPLE_PHRASES,
  type VoiceOutcomeInput,
} from '../../src/components/voice/order/copy';
import type { SupportFailure } from '../../src/services/supportService';
import type { CatalogMatch } from '../../src/services/voiceCatalog';

/**
 * The sheet is only ever as good as the sentence it shows when things go wrong.
 *
 * These tests are about wording, which is unusual to test — but the wording is
 * the feature here. A customer holding a recording of their grocery list has
 * exactly one question, "do I say that again or not", and the whole point of
 * routing every branch through one function is that the answer can be checked
 * rather than hoped for.
 */

const FAILURES: SupportFailure[] = [
  'silent',
  'missing-file',
  'invalid-audio',
  'offline',
  'unauthenticated',
  'busy',
  'timeout',
  'aborted',
  'unavailable',
];

const base: VoiceOutcomeInput = {
  denied: false,
  micFailed: false,
  tooShort: false,
  failure: null,
  transcript: '',
  matches: [],
  addable: [],
  pending: false,
};

const stocked = (name: string): CatalogMatch => ({
  query: name,
  productId: name,
  productName: name,
  quantity: 1,
  confidence: 'high',
});

/** Every screen the resolver can produce, so a rule can be applied to all. */
const EVERY_ENDING: VoiceOutcomeInput[] = [
  base,
  { ...base, denied: true },
  { ...base, micFailed: true },
  { ...base, tooShort: true },
  { ...base, addable: [stocked('banana')], matches: [stocked('banana')] },
  { ...base, pending: true, matches: [stocked('banana')] },
  ...FAILURES.map(failure => ({ ...base, failure })),
  ...FAILURES.map(failure => ({
    ...base,
    failure,
    transcript: 'do kelay',
  })),
  {
    ...base,
    transcript: 'anday',
    matches: [
      { query: 'anday', quantity: 1, confidence: 'low', unstocked: 'eggs' },
    ],
  },
];

const words = (line: string) => line.split(/\s+/).filter(Boolean);

describe('every ending of a voice order', () => {
  it('says something, and says it in words a shopper uses', () => {
    for (const input of EVERY_ENDING) {
      const outcome = describeVoiceOutcome(input);
      expect(outcome.title.length).toBeGreaterThan(0);
      expect(outcome.body.length).toBeGreaterThan(0);
      // The bar every one of these has to clear: a customer who reads only the
      // body knows what to do next. These four sentences never manage that.
      expect(outcome.body).not.toMatch(
        /something went wrong|unexpected error|please try again later|an error occurred/i,
      );
      // Nothing here is an exception thrown at a person.
      expect(outcome.title).not.toMatch(/error|failed|invalid/i);
    }
  });

  it('stays inside words and sentences a hurried reader can take in', () => {
    // Most people using this are shopping one-handed, in their second or third
    // language, and possibly in a shop. Long sentences are not a style problem
    // here — they are the difference between following the instruction and
    // giving up on the voice order.
    for (const input of EVERY_ENDING) {
      const outcome = describeVoiceOutcome(input);
      expect(words(outcome.title).length).toBeLessThanOrEqual(7);
      for (const sentence of outcome.body.split(/(?<=[.!?])\s+/)) {
        expect(words(sentence).length).toBeLessThanOrEqual(14);
      }
      // Dashes and semicolons are how two instructions get glued into one
      // sentence. Two instructions should be two sentences.
      expect(outcome.body).not.toMatch(/[—–;]/);
      // A long word is almost always the formal one: "unfortunately",
      // "temporarily", "authentication". The short synonym is the right word.
      for (const word of words(`${outcome.title} ${outcome.body}`))
        expect(word.replace(/[^A-Za-z]/g, '').length).toBeLessThanOrEqual(10);
    }
  });

  it('never asks for the list to be said again when the recording is fine', () => {
    // These are our problem, not the customer's mouth. Re-recording an order
    // because our service was busy is the rudest thing this sheet could do.
    for (const failure of ['offline', 'busy', 'timeout'] as SupportFailure[]) {
      expect(describeVoiceOutcome({ ...base, failure }).action).toBe('retry');
    }
  });

  it('does ask for it again when the recording itself is the problem', () => {
    for (const failure of [
      'silent',
      'invalid-audio',
      'missing-file',
    ] as SupportFailure[]) {
      expect(describeVoiceOutcome({ ...base, failure }).action).toBe('record');
    }
  });

  it('tells apart every failure the pipeline can report', () => {
    // With a transcript in hand the branches stop collapsing into "we heard
    // nothing", which is where distinct advice starts to matter.
    const titles = FAILURES.map(
      failure =>
        describeVoiceOutcome({ ...base, failure, transcript: 'do kelay' })
          .title,
    );
    // Not all nine need their own sentence — 'aborted' and 'unavailable' get
    // the same honest answer — but the ones with different repairs must differ.
    expect(new Set(titles).size).toBeGreaterThanOrEqual(4);
  });

  it('puts the microphone before everything else it might say', () => {
    // A denied mic makes every other sentence beside the point, including the
    // one about the network, which is also true and completely unhelpful.
    const outcome = describeVoiceOutcome({
      ...base,
      denied: true,
      failure: 'offline',
      transcript: 'do kelay',
    });
    expect(outcome.action).toBe('settings');
    expect(outcome.icon).toBe('settings');
  });

  it('hands a phrase to copy when how it was said is the thing to change', () => {
    // "Speak clearly" is not advice. A line that works is.
    expect(describeVoiceOutcome({ ...base, tooShort: true }).example).toBe(
      EXAMPLE_PHRASES[0],
    );
    expect(describeVoiceOutcome({ ...base, failure: 'silent' }).example).toBe(
      EXAMPLE_PHRASES[0],
    );
    // And not when it isn't: the words were fine, the network was not.
    expect(
      describeVoiceOutcome({ ...base, failure: 'offline' }).example,
    ).toBeUndefined();
  });

  it('blames the shelf for a stocked-out item, never the customer', () => {
    const outcome = describeVoiceOutcome({
      ...base,
      transcript: 'anday',
      matches: [
        { query: 'anday', quantity: 1, confidence: 'low', unstocked: 'eggs' },
      ],
    });
    expect(outcome.tone).toBe('shelf');
    expect(outcome.body).toContain('eggs');
    expect(outcome.body).not.toMatch(
      /did not hear|could not hear|say it again/i,
    );
  });

  it('counts the items it found, so the number can be checked', () => {
    const one = describeVoiceOutcome({
      ...base,
      matches: [stocked('banana')],
      addable: [stocked('banana')],
    });
    expect(one.body).toContain('1 item');
    expect(one.action).toBe('add');

    const two = describeVoiceOutcome({
      ...base,
      matches: [stocked('banana'), stocked('tomato')],
      addable: [stocked('banana'), stocked('tomato')],
    });
    expect(two.body).toContain('2 items');
  });

  it('mentions the open question when one item is still a guess', () => {
    const outcome = describeVoiceOutcome({
      ...base,
      matches: [stocked('banana'), stocked('tomato')],
      addable: [stocked('banana')],
      pending: true,
    });
    expect(outcome.tone).toBe('ask');
    expect(outcome.body).toMatch(/guess/i);
  });
});
