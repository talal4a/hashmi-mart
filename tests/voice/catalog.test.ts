import {
  matchCatalog,
  matchOrder,
  orderConfidence,
  readOrder,
  readQuantity,
  scanTranscript,
  unresolvedFragments,
  isConfidentlyUnderstood,
  CATALOG,
} from '../../src/services/voiceCatalog';

/**
 * The correctness layer, tested as such.
 *
 * The model above this is not trustworthy on its own — asked to normalise a
 * shopping list it will produce something plausible for a word it did not
 * understand. A plausible wrong item is worse than a missing one: the customer
 * confirms a list that looks right and receives something else. So the two
 * properties worth pinning are that a real word matches, and that a word we do
 * not sell never quietly becomes one we do.
 */

describe('spoken quantities', () => {
  it.each([
    ['do kilo tamatar', 2],
    ['teen kela', 3],
    ['aik packet doodh', 1],
    ['paanch machli', 5],
    ['das seb', 10],
    ['darjan machli', 12],
    ['2 kilo aloo', 2],
  ])('reads %s as %s', (phrase, expected) => {
    expect(readQuantity(phrase)?.quantity).toBe(expected);
  });

  it('reads the fractional words Pakistani orders actually use', () => {
    expect(readQuantity('aadha kilo cheeni')).toEqual({ quantity: 0.5, unit: 'kg' });
    expect(readQuantity('paao adrak')).toEqual({ quantity: 0.25, unit: 'kg' });
  });

  it('returns nothing rather than guessing when no number was said', () => {
    // A missing quantity is a stepper the customer nudges once. A wrong one is
    // a delivery nobody wanted.
    expect(readQuantity('tamatar')).toBeNull();
  });
});

describe('catalog matching', () => {
  it('matches an item said in Urdu to the catalogue entry', () => {
    const match = matchCatalog('tamatar');
    expect(match.productId).toBe('tomato');
    expect(match.confidence).toBe('high');
  });

  it('finds the item among the quantity words', () => {
    const match = matchCatalog('do kilo tamatar');
    expect(match.productId).toBe('tomato');
    expect(match.quantity).toBe(2);
    expect(match.confidence).toBe('high');
  });

  it('prefers the quantity the customer said over the one the model reported', () => {
    // The phrase is the customer's own words; the separate number is an
    // interpretation of them.
    const match = matchCatalog('teen kela', 9);
    expect(match.quantity).toBe(3);
  });

  it('falls back to the model’s quantity when the phrase has none', () => {
    expect(matchCatalog('kela', 4).quantity).toBe(4);
  });

  it('defaults to one rather than to zero', () => {
    expect(matchCatalog('kela').quantity).toBe(1);
  });

  it('trusts a spelling that is on the alias list', () => {
    // "tamater" is a way people actually write it, so it is listed — and a
    // listed spelling is a known word, not a guess.
    const match = matchCatalog('tamater');
    expect(match.productId).toBe('tomato');
    expect(match.confidence).toBe('high');
  });

  it('tolerates an unlisted misspelling, but only as a candidate', () => {
    const match = matchCatalog('tamataar');
    expect(match.productId).toBe('tomato');
    // Never 'high' from a fuzzy hit: the sheet must ask about it rather than
    // adding it quietly.
    expect(match.confidence).toBe('medium');
  });

  it('never invents a product for something not sold here', () => {
    // The whole point. An unmatched item comes back visible and low, so it can
    // be shown greyed out — a silently dropped item is how an order arrives
    // short, and a silently substituted one is worse.
    const match = matchCatalog('washing machine');
    expect(match.productId).toBeUndefined();
    expect(match.confidence).toBe('low');
    expect(match.query).toBe('washing machine');
  });

  it.each(['namak', 'shampoo', 'diesel', 'aeroplane'])(
    'does not fuzzy-match %s onto an unrelated product',
    query => {
      const match = matchCatalog(query);
      // Either no match, or one whose alias genuinely contains the word.
      if (match.productId) {
        const entry = CATALOG.find(c => c.id === match.productId)!;
        const close = entry.aliases.some(
          alias => alias.includes(query) || query.includes(alias),
        );
        expect(close).toBe(true);
      }
    },
  );
});

describe('order confidence', () => {
  it('takes the weakest item, not the average', () => {
    // Four confident matches must not carry one wrong one past the customer.
    const matches = matchOrder([
      { query: 'tamatar' },
      { query: 'kela' },
      { query: 'washing machine' },
    ]);
    expect(orderConfidence(matches)).toBe('low');
  });

  it('is high only when every item is', () => {
    expect(orderConfidence(matchOrder([{ query: 'tamatar' }, { query: 'kela' }]))).toBe(
      'high',
    );
  });

  it('treats an empty order as low', () => {
    // Nothing understood is not the same as nothing wrong.
    expect(orderConfidence([])).toBe('low');
  });
});

/**
 * Urdu and Punjabi, which is where this actually failed in the field.
 *
 * Whisper returns Urdu speech in Urdu script — "ٹماٹر", not "tamatar" — and
 * every alias was Latin, so a genuinely Urdu order matched nothing while
 * English worked perfectly. That asymmetry is exactly what the store reported,
 * and it is invisible in any test written in Roman.
 */
describe('Urdu script', () => {
  it.each([
    ['ٹماٹر', 'tomato'],
    ['کیلا', 'banana'],
    ['پالک', 'spinach'],
    ['سیب', 'apple'],
    ['کھیرا', 'cucumber'],
  ])('matches %s to the catalogue', (spoken, id) => {
    expect(matchCatalog(spoken).productId).toBe(id);
  });

  it('reads a quantity written in Urdu words', () => {
    const match = matchCatalog('دو کلو ٹماٹر');
    expect(match.productId).toBe('tomato');
    expect(match.quantity).toBe(2);
  });

  it('reads Urdu-Indic digits', () => {
    // "۲ کلو" is two kilos. Untranslated it is not a number to JavaScript, and
    // the quantity is silently lost.
    expect(readQuantity('۲ کلو ٹماٹر')?.quantity).toBe(2);
    expect(readQuantity('۵ کیلے')?.quantity).toBe(5);
  });

  it('reads the Urdu fractional words', () => {
    expect(readQuantity('آدھا کلو پالک')).toEqual({ quantity: 0.5, unit: 'kg' });
    expect(readQuantity('پاؤ ادرک')).toEqual({ quantity: 0.25, unit: 'kg' });
  });

  it('is unbothered by diacritics and letter variants', () => {
    // Optional harakat, and ی vs ي — the same word to a reader, different
    // strings to a comparison.
    expect(matchCatalog('ٹَماٹر').productId).toBe('tomato');
    expect(matchCatalog('كھیرا').productId).toBe('cucumber');
  });

  it('handles a whole Urdu order', () => {
    const matches = matchOrder([
      { query: 'دو کلو ٹماٹر' },
      { query: 'تین کیلے' },
      { query: 'آدھا کلو پالک' },
    ]);
    expect(matches.map(m => m.productId)).toEqual(['tomato', 'banana', 'spinach']);
    expect(matches.map(m => m.quantity)).toEqual([2, 3, 0.5]);
    expect(orderConfidence(matches)).toBe('high');
  });
});

describe('Punjabi', () => {
  it('reads Punjabi number words', () => {
    // panj, not paanch.
    expect(readQuantity('panj kele')?.quantity).toBe(5);
    expect(readQuantity('trai tamatar')?.quantity).toBe(3);
    expect(readQuantity('ikk seb')?.quantity).toBe(1);
  });

  it('matches the Punjabi word for cucumber', () => {
    expect(matchCatalog('kakri').productId).toBe('cucumber');
  });
});

describe('the products that had no aliases at all', () => {
  it.each([
    ['palak', 'spinach'],
    ['saag', 'spinach'],
    ['kheera', 'cucumber'],
    ['khira', 'cucumber'],
  ])('matches %s', (spoken, id) => {
    // Two of five stocked products had no Urdu aliases whatsoever, while
    // aliases existed for milk and fish, which are not stocked.
    expect(matchCatalog(spoken).productId).toBe(id);
  });
});

/**
 * Reading the sentence itself.
 *
 * `matchCatalog` answers "which product is this phrase" — one phrase, one
 * answer — which silently loses every item but one when it is hmachhlid a whole
 * sentence. That is what "I need bananas and tomatoes" came back with: the
 * tomatoes. These pin the floor under the model: whatever the parse does or
 * fails to do, a sentence naming things we stock produces those things.
 */
describe('scanning a whole sentence', () => {
  it('finds every product named, not just the first', () => {
    const found = scanTranscript('mujhe kela aur tamatar chahiye');
    expect(found.map(match => match.productId)).toEqual(['banana', 'tomato']);
  });

  it('finds them in Urdu script, in the order they were said', () => {
    const found = scanTranscript('مجھے کیلا اور ٹماٹر چاہیے');
    expect(found.map(match => match.productId)).toEqual(['banana', 'tomato']);
  });

  it('gives each item the quantity said in front of it', () => {
    const found = scanTranscript('دو کلو ٹماٹر اور تین کیلے');
    expect(found).toEqual([
      expect.objectContaining({ productId: 'tomato', quantity: 2 }),
      expect.objectContaining({ productId: 'banana', quantity: 3 }),
    ]);
  });

  it('does not read one item quantity onto the next item', () => {
    // "teen" belongs to the bananas. The spinach that follows was not ordered
    // three times, and defaulting to one is the answer a stepper fixes.
    const found = scanTranscript('teen kele palak');
    expect(found).toEqual([
      expect.objectContaining({ productId: 'banana', quantity: 3 }),
      expect.objectContaining({ productId: 'spinach', quantity: 1 }),
    ]);
  });

  it('reads aadha and paao as weights, not as counts', () => {
    expect(scanTranscript('aadha kilo palak')).toEqual([
      expect.objectContaining({ productId: 'spinach', quantity: 0.5, unit: 'kg' }),
    ]);
  });

  it('says the same thing twice and means it once', () => {
    const found = scanTranscript('tamatar chahiye, do kilo tamatar');
    expect(found).toHaveLength(1);
    expect(found[0].productId).toBe('tomato');
  });

  it('finds nothing in a sentence that names nothing we sell', () => {
    expect(scanTranscript('kuch bhej do jaldi')).toEqual([]);
    expect(scanTranscript('')).toEqual([]);
  });

  it('never claims high confidence for a word it had to guess at', () => {
    // A sentence is long enough that some word is always within an edit of
    // something; the loose pass exists, but it is not allowed to look certain.
    const found = scanTranscript('mujhe tamatarr chahiye');
    expect(found[0]?.productId).toBe('tomato');
    expect(found[0]?.confidence).not.toBe('high');
  });
});

/**
 * The two readings together.
 *
 * The parse splits and counts; the scan cannot miss. Neither is trusted alone,
 * and the merge has to keep what only one of them knows.
 */
describe('reading an order', () => {
  it('recovers an item the model dropped', () => {
    // The model returned the sentence unsplit, so it is one match and the
    // bananas are gone. The scan puts them back.
    const read = readOrder('kela aur tamatar', [{ query: 'kela aur tamatar' }]);
    expect(read.map(match => match.productId).sort()).toEqual([
      'banana',
      'tomato',
    ]);
  });

  it('keeps the model quantity for an item it did report', () => {
    const read = readOrder('do kilo tamatar aur kela', [
      { query: 'tamatar', quantity: 2 },
    ]);
    expect(read).toContainEqual(
      expect.objectContaining({ productId: 'tomato', quantity: 2 }),
    );
    expect(read).toContainEqual(
      expect.objectContaining({ productId: 'banana' }),
    );
  });

  it('keeps an item we do not stock, which the scan can never report', () => {
    // "Heard, but not sold here" is the one thing only the parse knows: the
    // scan sees the shelf, so it can only ever find what is on it.
    const read = readOrder('mujhe machli chahiye', [{ query: 'machli' }]);
    expect(read).toEqual([
      expect.objectContaining({ query: 'machli', confidence: 'low' }),
    ]);
  });

  it('does not duplicate an item both readings found', () => {
    const read = readOrder('do kilo tamatar', [
      { query: 'tamatar', quantity: 2 },
    ]);
    expect(read).toHaveLength(1);
  });
});

/**
 * Understood, and not on the shelf.
 *
 * These two failures used to be one: an item we do not sell and a word we
 * could not place both came back as an unmatched row saying "not sold here".
 * They deserve different words because they call for different actions —
 * saying the order again fixes a misheard word and will never conjure fish —
 * and telling a customer we did not understand them when we understood
 * perfectly is the worse of the two mistakes.
 */
describe('items we know and do not sell', () => {
  it('names an unstocked item rather than shrugging at it', () => {
    const match = matchCatalog('machli');
    expect(match.productId).toBeUndefined();
    expect(match.unstocked).toBe('fish');
  });

  it('names it from Urdu script too', () => {
    expect(matchCatalog('مچھلی').unstocked).toBe('fish');
  });

  it('leaves a word it genuinely could not place unnamed', () => {
    const match = matchCatalog('zzzqqq');
    expect(match.productId).toBeUndefined();
    expect(match.unstocked).toBeUndefined();
    expect(match.confidence).toBe('low');
  });

  it('finds one inside a sentence, beside an item we do stock', () => {
    const found = scanTranscript('مجھے کیلا اور مچھلی چاہیے');
    expect(found).toHaveLength(2);
    expect(found[0].productId).toBe('banana');
    expect(found[1].unstocked).toBe('fish');
    // No id, so nothing downstream can put it in a cart.
    expect(found[1].productId).toBeUndefined();
  });

  it('never gives an unstocked item an id that could reach a cart', () => {
    for (const match of scanTranscript('machli chawal aloo namak')) {
      if (match.unstocked) expect(match.productId).toBeUndefined();
    }
  });

  it('does not say the same shelf is empty twice', () => {
    // The parse reported the fish and the scan finds them again.
    const read = readOrder('kela aur machli', [{ query: 'machli' }]);
    expect(read.filter(match => match.unstocked === 'fish')).toHaveLength(1);
  });
});

/**
 * Coverage: what the sentence said that nothing accounted for.
 *
 * Two jobs. It decides whether a model needs to be called at all — most orders
 * are catalogue words and numbers, and asking a model to confirm that costs a
 * second of the customer's time and one request of a small free quota to agree
 * with us. And it is what stops a half-understood order being presented as a
 * confident one: a sentence that produced two items and quietly dropped a third
 * thing the customer said is how an order arrives short.
 */
describe('coverage', () => {
  it('leaves nothing over when every word is a product, a number or grammar', () => {
    const transcript = 'mujhe do kilo tamatar aur aik kela chahiye';
    const matches = scanTranscript(transcript);
    expect(unresolvedFragments(transcript, matches)).toEqual([]);
    expect(isConfidentlyUnderstood(transcript, matches)).toBe(true);
  });

  it('keeps an unplaced phrase together rather than as loose words', () => {
    // "tarang bara wala" is one thing somebody asked for. Three unrelated chips
    // is not a question anyone can answer.
    const transcript = 'do kilo tamatar aur tarang bara wala';
    const matches = scanTranscript(transcript);
    expect(unresolvedFragments(transcript, matches)).toEqual(['tarang bara wala']);
  });

  it('sends a sentence with something left in it to the model', () => {
    const transcript = 'do kilo tamatar aur tarang bara wala';
    const matches = scanTranscript(transcript);
    // Exactly the case a model is better at than a table of aliases.
    expect(isConfidentlyUnderstood(transcript, matches)).toBe(false);
  });

  it('does not trust a fuzzy hit enough to skip the model', () => {
    // "spinch" is a near miss, not an alias. A guess is a candidate to ask
    // about, never a reason to stop checking — and the model is exactly the
    // thing that might read it better than an edit distance can.
    const transcript = 'spinch do';
    const matches = scanTranscript(transcript);
    const hit = matches.find(match => match.productId === 'spinach');
    expect(hit?.confidence).toBe('medium');
    expect(isConfidentlyUnderstood(transcript, matches)).toBe(false);
  });

  it('never calls an empty order understood', () => {
    expect(isConfidentlyUnderstood('kuch samajh nahi aaya', [])).toBe(false);
    expect(isConfidentlyUnderstood('', [])).toBe(false);
  });

  it('counts a word we understand but do not sell as accounted for', () => {
    // We heard "machli" perfectly. It is not an unresolved fragment — it is a
    // shelf we do not stock, which is a different thing to be told.
    const transcript = 'machli chay aur aik kela';
    const matches = scanTranscript(transcript);
    expect(unresolvedFragments(transcript, matches)).toEqual([]);
  });
});
