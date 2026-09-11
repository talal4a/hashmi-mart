import {
  scanTranscript,
  unresolvedFragments,
  skeleton,
  CATALOG,
} from '../../src/services/voiceCatalog';

/**
 * Real orders, in the shapes they actually arrive in.
 *
 * Every case here is a transcript the app has to survive rather than a phrase
 * chosen to pass. The four hard families:
 *
 *   Devanagari, because Whisper decides Punjabi is Hindi more often than not.
 *   Gurmukhi, for the decodes that do come back as Punjabi.
 *   Roman Urdu, which has no agreed spelling at all.
 *   Long orders, because the item that goes missing is nearly always the last.
 *
 * `expect` is the products in the order they were said. A case that finds four
 * of five is a failure here even though it looks like a working app.
 */

type Case = {
  /** What the transcript looked like. */
  said: string;
  /** Product ids in spoken order, with the quantity each should carry. */
  want: [string, number][];
  /** Phrases we should admit we could not place. */
  leftover?: string[];
};

const read = (said: string) => {
  const matches = scanTranscript(said);
  return {
    got: matches
      .filter(match => match.productId)
      .map(match => [match.productId, match.quantity] as [string, number]),
    leftover: unresolvedFragments(said, matches),
  };
};

const run = (label: string, cases: Case[]) => {
  describe(label, () => {
    for (const item of cases) {
      it(item.said, () => {
        const { got, leftover } = read(item.said);
        expect(got).toEqual(item.want);
        if (item.leftover) expect(leftover).toEqual(item.leftover);
      });
    }
  });
};

run('Urdu script', [
  { said: 'دو کلو ٹماٹر اور ایک کیلا', want: [['tomato', 2], ['banana', 1]] },
  { said: 'مجھے تین سیب چاہیے', want: [['apple', 3]] },
  { said: 'پالک اور کھیرا', want: [['spinach', 1], ['cucumber', 1]] },
  {
    said: 'دو کلو ٹماٹر چار کیلے تین سیب اور ایک کھیرا',
    want: [['tomato', 2], ['banana', 4], ['apple', 3], ['cucumber', 1]],
  },
  { said: 'آدھا کلو پالک', want: [['spinach', 0.5]] },
  { said: '۲ کلو ٹماٹر', want: [['tomato', 2]] },
]);

/**
 * The family this whole change exists for.
 *
 * Whisper labels Punjabi as Hindi and returns Devanagari. Nothing in the
 * matcher folded or aliased it, so these transcripts matched absolutely
 * nothing — the customer spoke a perfectly ordinary order and the app said it
 * could not understand a word.
 */
run('Devanagari, which is what Punjabi usually comes back as', [
  { said: 'दो किलो टमाटर', want: [['tomato', 2]] },
  { said: 'मुझे तीन केले चाहिए', want: [['banana', 3]] },
  { said: 'एक सेब और दो खीरा', want: [['apple', 1], ['cucumber', 2]] },
  {
    said: 'दो किलो टमाटर चार केले तीन सेब और पालक',
    want: [['tomato', 2], ['banana', 4], ['apple', 3], ['spinach', 1]],
  },
  { said: 'आधा किलो पालक', want: [['spinach', 0.5]] },
  { said: '२ किलो टमाटर', want: [['tomato', 2]] },
]);

run('Gurmukhi', [
  { said: 'ਦੋ ਕਿਲੋ ਟਮਾਟਰ', want: [['tomato', 2]] },
  { said: 'ਮੈਨੂੰ ਤਿੰਨ ਕੇਲੇ ਚਾਹੀਦਾ', want: [['banana', 3]] },
  { said: 'ਇੱਕ ਸੇਬ ਅਤੇ ਪੰਜ ਖੀਰੇ', want: [['apple', 1], ['cucumber', 5]] },
  {
    said: 'ਦੋ ਕਿਲੋ ਟਮਾਟਰ ਅੱਠ ਕੇਲੇ ਅਤੇ ਪਾਲਕ',
    want: [['tomato', 2], ['banana', 8], ['spinach', 1]],
  },
]);

run('Roman Urdu, spelled however it came out', [
  { said: 'do kilo tamatar aur aik kela', want: [['tomato', 2], ['banana', 1]] },
  { said: 'do kilo tamater aur ek kaila', want: [['tomato', 2], ['banana', 1]] },
  { said: 'teen timaatar', want: [['apple', 3]].length ? [['tomato', 3]] : [] },
  { said: 'paanch keele', want: [['banana', 5]] },
  { said: 'adha kilo paalak aur kheere', want: [['spinach', 0.5], ['cucumber', 1]] },
  { said: 'char seb', want: [['apple', 4]] },
]);

/**
 * The last item, which is the one that goes missing.
 *
 * A fast speaker runs the words together and taps Stop on the final syllable.
 * Nothing in the matcher may treat the end of a sentence differently from the
 * middle of one.
 */
run('long and fast', [
  {
    said: 'tamatar do kela aik palak teen kheera do seb char',
    want: [
      ['tomato', 2],
      ['banana', 1],
      ['spinach', 3],
      ['cucumber', 2],
      ['apple', 4],
    ],
  },
  {
    said: 'do tamatar aik kela teen palak do kheera char seb',
    want: [
      ['tomato', 2],
      ['banana', 1],
      ['spinach', 3],
      ['cucumber', 2],
      ['apple', 4],
    ],
  },
  {
    said: 'ٹماٹر دو کیلا ایک پالک تین کھیرا دو سیب چار',
    want: [
      ['tomato', 2],
      ['banana', 1],
      ['spinach', 3],
      ['cucumber', 2],
      ['apple', 4],
    ],
  },
]);

run('mixed scripts in one sentence, which is how people actually talk', [
  { said: 'दो किलो tamatar aur ایک کیلا', want: [['tomato', 2], ['banana', 1]] },
  { said: 'two kilo ٹماٹر and teen kela', want: [['tomato', 2], ['banana', 3]] },
]);

run('heard, and honestly reported as not understood', [
  {
    said: 'do kilo tamatar aur bara wala surf',
    want: [['tomato', 2]],
    leftover: ['bara wala surf'],
  },
  {
    said: 'दो किलो टमाटर और तारंग',
    want: [['tomato', 2]],
    leftover: ['तारंग'],
  },
]);

/**
 * Whisper's own mistakes, which are the transcripts the app actually gets.
 *
 * None of these are what the customer said. All of them are what came back.
 */
run('a decode that went wrong in the ordinary ways', [
  // Vowels are what Whisper guesses at in Roman Urdu.
  { said: 'do kilo tomatar aur do kaile', want: [['tomato', 2], ['banana', 2]] },
  { said: 'teen palk', want: [['spinach', 3]] },
  { said: 'char khira', want: [['cucumber', 4]] },
  // Doubled letters from a leaned-on key.
  { said: 'do kilo tammatar', want: [['tomato', 2]] },
  // An English plural on an Urdu word.
  { said: 'do kelas', want: [['banana', 2]] },
]);

run('the quantity, in every shape it is said', [
  { said: 'tamatar', want: [['tomato', 1]] },
  { said: '3 kilo tamatar', want: [['tomato', 3]] },
  { said: 'darjan kela', want: [['banana', 12]] },
  { said: 'dozen kela', want: [['banana', 12]] },
  { said: 'pao palak', want: [['spinach', 0.25]] },
  { said: 'aadha kilo kheera', want: [['cucumber', 0.5]] },
  { said: 'das seb', want: [['apple', 10]] },
]);

/**
 * Things that must never happen.
 *
 * A plausible wrong item is worse than a missing one: the customer confirms a
 * list that looks right and receives something else. These are the confusions
 * a looser matcher would make, and every one of them is a real grocery word.
 */
run('never the wrong grocery', [
  // Salt is two edits from spinach and we do not sell salt.
  { said: 'namak do', want: [] },
  // Units and grammar are not products, however much they sound like one.
  { said: 'do kilo', want: [] },
  { said: 'mujhe chahiye', want: [] },
  // A word we have never heard of stays a word we have never heard of.
  { said: 'zzzqqq do', want: [], leftover: ['zzzqqq'] },
]);

run('understood, and not on the shelf', [
  // Heard perfectly. "We do not stock eggs" and "we did not catch you" are
  // different things to be told, and only one is worth repeating the order for.
  { said: 'anday chay aur do kilo tamatar', want: [['tomato', 2]], leftover: [] },
  { said: 'अंडे छह और दो किलो टमाटर', want: [['tomato', 2]], leftover: [] },
  { said: 'doodh do bread aik', want: [], leftover: [] },
]);

describe('the sound index', () => {
  it('joins every spelling of a word people cannot agree how to spell', () => {
    // All four differ only in vowels, which is what Roman Urdu actually varies.
    const shapes = ['tamatar', 'tamater', 'timaatar', 'tamaatar'];
    expect(new Set(shapes.map(skeleton)).size).toBe(1);
    // A dropped consonant gap is a different kind of slip and belongs to the
    // edit-distance tier; sound cannot invent a vowel that was never written.
    expect(skeleton('tamatr')).not.toBe(skeleton('tamatar'));
    expect(scanTranscript('tamatr do')[0]?.productId).toBe('tomato');
  });

  it('keeps apart the words that a loose distance would confuse', () => {
    // Two edits apart and completely different groceries. This pair is why the
    // edit distance is tight and why sound has to keep consonants.
    expect(skeleton('namak')).not.toBe(skeleton('palak'));
    expect(skeleton('seb')).not.toBe(skeleton('saag'));
  });

  it('gives no two products the same sound', () => {
    // A sound that could be either of two groceries is a coin toss, not a
    // match — the index drops those rather than picking the first defined.
    const byKey = new Map<string, Set<string>>();
    for (const entry of CATALOG) {
      for (const alias of entry.aliases) {
        if (alias.includes(' ')) continue;
        const key = skeleton(alias);
        if (key.length < 3) continue;
        const held = byKey.get(key) ?? new Set<string>();
        held.add(entry.id);
        byKey.set(key, held);
      }
    }
    const collisions = [...byKey.entries()].filter(([, ids]) => ids.size > 1);
    // Reported rather than merely counted, so a future alias that collides
    // says which words it was.
    expect(collisions.map(([key, ids]) => `${key}: ${[...ids].join('/')}`)).toEqual(
      [],
    );
  });
});
