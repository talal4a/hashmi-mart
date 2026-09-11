import {
  scanTranscript,
  unresolvedFragments,
  skeleton,
  productBySound,
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
    // Surf is on the shelf now, so the only thing left unplaced is the size.
    said: 'do kilo tamatar aur bara wala surf',
    want: [['tomato', 2], ['surf', 1]],
    leftover: ['bara wala'],
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
  // Salt is two edits from spinach. It must come back as salt, which we now
  // stock, and never as spinach.
  { said: 'namak do', want: [['salt', 2]] },
  // Units and grammar are not products, however much they sound like one.
  { said: 'do kilo', want: [] },
  { said: 'mujhe chahiye', want: [] },
  // A word we have never heard of stays a word we have never heard of.
  { said: 'zzzqqq do', want: [], leftover: ['zzzqqq'] },
]);

/**
 * The orders people actually place.
 *
 * Every one of these was understood perfectly and filled nothing, back when the
 * shop stocked five vegetables — which looks from the outside like the AI
 * failing and is really an empty shelf.
 */
run('a real grocery order', [
  { said: 'anday chay aur do kilo tamatar', want: [['eggs', 6], ['tomato', 2]], leftover: [] },
  { said: 'अंडे छह और दो किलो टमाटर', want: [['eggs', 6], ['tomato', 2]], leftover: [] },
  { said: 'doodh do bread aik', want: [['milk', 2], ['bread', 1]], leftover: [] },
  // The brand and the category are the same order.
  { said: 'olpers do aur bread aik', want: [['milk', 2], ['bread', 1]], leftover: [] },
  { said: 'aloo do kilo pyaz aik kilo', want: [['potato', 2], ['onion', 1]] },
  { said: 'chai patti aur cheeni', want: [['tea', 1], ['sugar', 1]] },
  { said: 'kok do aur surf aik', want: [['coke', 2], ['surf', 1]] },
  {
    said: 'doodh do bread aik anday chay chawal aik kilo',
    want: [['milk', 2], ['bread', 1], ['eggs', 6], ['rice', 1]],
  },
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

  it('refuses a sound that two products share, rather than picking one', () => {
    // Real groceries rhyme. "cheeni" and "chana" collapse to one sound, as do
    // "chakki" and "coke" — no tuning separates those, because they genuinely
    // sound alike once Roman Urdu's vowels are folded.
    //
    // The guarantee is not that collisions cannot happen. It is that a
    // colliding sound reaches nothing: a coin toss between sugar and lentils is
    // worse than admitting we did not catch the word, and the flour/Coke pair
    // was quietly putting a bag of atta in the cart for anyone saying "coke".
    const byKey = new Map<string, Set<string>>();
    for (const entry of CATALOG) {
      for (const alias of entry.aliases) {
        if (alias.includes(' ')) continue;
        const key = skeleton(alias);
        if (key.length < 3) continue;
        byKey.set(key, (byKey.get(key) ?? new Set<string>()).add(entry.id));
      }
    }

    const shared = [...byKey.entries()].filter(([, ids]) => ids.size > 1);
    // Not zero. A real shelf has rhyming products on it.
    expect(shared.length).toBeGreaterThan(0);

    // And not one of them is reachable by sound.
    for (const [key] of shared) {
      const reachable = [...byKey.keys()].find(
        candidate => candidate === key && productBySound(candidate) !== undefined,
      );
      expect(reachable).toBeUndefined();
    }

    // While both members stay perfectly reachable by name.
    expect(scanTranscript('cheeni aik')[0]?.productId).toBe('sugar');
    expect(scanTranscript('chana aik')[0]?.productId).toBe('lentils');
    expect(scanTranscript('coke do')[0]?.productId).toBe('coke');
  });
});
