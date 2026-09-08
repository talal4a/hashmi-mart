import {
  matchCatalog,
  matchOrder,
  orderConfidence,
  readQuantity,
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
    ['paanch anday', 5],
    ['das seb', 10],
    ['darjan anday', 12],
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
