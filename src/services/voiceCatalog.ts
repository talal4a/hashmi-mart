import { freshPicks } from '../data/groceryHome';

/**
 * Turning what someone said into something HashmiMart actually sells.
 *
 * This is the correctness layer, and it exists because the model above it is
 * not one. An LLM asked to normalise a shopping list will produce something
 * plausible for a word it did not understand, and a plausible wrong item is
 * worse than a missing one: the customer confirms a list that looks right and
 * receives something else. So nothing reaches the confirmation sheet unless it
 * matched a real catalogue entry, and anything that matched weakly is marked
 * rather than quietly accepted.
 *
 * Matching is deliberately conservative and explainable — exact, then alias,
 * then prefix, then a bounded edit distance. No embeddings, no scoring model.
 * When a grocery order goes wrong the question is always "why did it pick
 * that", and every answer here is one line long.
 */

export type CatalogEntry = {
  id: string;
  name: string;
  /** Everything a customer might call it, across the languages they use. */
  aliases: readonly string[];
};

/**
 * Aliases carry the languages, not the matcher.
 *
 * The alternative is transliteration rules, and they do not survive contact
 * with real speech: "anday", "ande" and "aanday" are the same word written by
 * three people, and no rule set produces all three from "eggs". A list is
 * dull and it is right.
 */
const ALIASES: Record<string, readonly string[]> = {
  tomato: ['tamatar', 'tamater', 'tomato', 'tomatoes', 'tmatar'],
  banana: ['kela', 'kaila', 'banana', 'bananas'],
  potato: ['aloo', 'alu', 'potato', 'potatoes'],
  onion: ['pyaz', 'piyaz', 'pyaaz', 'onion', 'onions'],
  milk: ['doodh', 'dudh', 'dodh', 'milk'],
  eggs: ['anday', 'ande', 'aanday', 'egg', 'eggs'],
  bread: ['bread', 'double roti', 'dabal roti'],
  rice: ['chawal', 'chaval', 'rice'],
  flour: ['aata', 'atta', 'flour'],
  sugar: ['cheeni', 'chini', 'sugar'],
  tea: ['chai', 'chaye', 'patti', 'tea'],
  oil: ['tel', 'oil', 'cooking oil'],
  yoghurt: ['dahi', 'yoghurt', 'yogurt', 'curd'],
  apple: ['seb', 'saib', 'apple', 'apples'],
  orange: ['santra', 'santara', 'orange', 'oranges'],
  chicken: ['murghi', 'murgi', 'chicken'],
  lentils: ['dal', 'daal', 'lentil', 'lentils'],
  salt: ['namak', 'salt'],
  garlic: ['lehsan', 'lasan', 'garlic'],
  ginger: ['adrak', 'ginger'],
};

/**
 * The catalogue, built from what the app actually stocks.
 *
 * Derived from `freshPicks` rather than written out again, so an item that is
 * removed from the shelf cannot keep being matched. Aliases are looked up by
 * the words in the product's own name, which is what keeps the two in step
 * without a second list to maintain.
 */
export const CATALOG: readonly CatalogEntry[] = freshPicks.map(item => {
  const words = item.name.toLowerCase().split(/\s+/);
  const aliases = new Set<string>([item.name.toLowerCase(), ...words]);
  for (const word of words) {
    for (const alias of ALIASES[word] ?? []) aliases.add(alias);
  }
  return { id: item.id, name: item.name, aliases: [...aliases] };
});

/** How sure we are, and therefore how the sheet should treat it. */
export type MatchConfidence = 'high' | 'medium' | 'low';

export type CatalogMatch = {
  /** What the speaker asked for, kept so an unmatched item can still be shown. */
  query: string;
  productId?: string;
  productName?: string;
  quantity: number;
  unit?: string;
  confidence: MatchConfidence;
};

/**
 * Spoken numbers, in the forms people actually use.
 *
 * Kept here rather than left to the model because a quantity is the one field
 * where being wrong is expensive and being absent is not: "do kilo" heard as
 * ten kilos is a delivery nobody wanted, while a missing quantity is a stepper
 * the customer nudges once.
 */
const NUMBERS: Record<string, number> = {
  aik: 1, ek: 1, ik: 1, one: 1,
  do: 2, doo: 2, two: 2,
  teen: 3, tin: 3, three: 3,
  chaar: 4, char: 4, four: 4,
  paanch: 5, panch: 5, five: 5,
  chay: 6, che: 6, chhe: 6, six: 6,
  saat: 7, seven: 7,
  aath: 8, ath: 8, eight: 8,
  nau: 9, no: 9, nine: 9,
  das: 10, ten: 10,
  darjan: 12, dozen: 12,
};

/** Words that carry a quantity of their own. */
const FRACTIONS: Record<string, { quantity: number; unit: string }> = {
  paao: { quantity: 0.25, unit: 'kg' },
  pao: { quantity: 0.25, unit: 'kg' },
  aadha: { quantity: 0.5, unit: 'kg' },
  adha: { quantity: 0.5, unit: 'kg' },
  half: { quantity: 0.5, unit: 'kg' },
};

/** Reads a spoken quantity out of a phrase, or nothing if none was said. */
export function readQuantity(
  phrase: string,
): { quantity: number; unit?: string } | null {
  const words = normalise(phrase).split(' ');
  for (const word of words) {
    const fraction = FRACTIONS[word];
    if (fraction) return fraction;
    const spoken = NUMBERS[word];
    if (spoken !== undefined) return { quantity: spoken };
    const digits = Number(word);
    if (Number.isFinite(digits) && digits > 0 && digits <= 99) {
      return { quantity: digits };
    }
  }
  return null;
}

/** Lowercase, unpunctuated, single-spaced. Everything compares in this form. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein, capped.
 *
 * Bounded at two edits and short-circuited on length, because the useful cases
 * are a dropped vowel or a doubled consonant. Anything further apart than that
 * is a different word, and letting the distance grow is how "namak" starts
 * matching "banana".
 */
function withinTwoEdits(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 2) return false;
  if (a === b) return true;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
      best = Math.min(best, current[j]);
    }
    // Every path through this row is already too expensive.
    if (best > 2) return false;
    previous = current;
  }
  return previous[b.length] <= 2;
}

/**
 * Matches one spoken request against the catalogue.
 *
 * The tiers are ordered by how much they are trusted, and the confidence
 * returned says which one fired. A fuzzy hit is deliberately never 'high': it
 * is a candidate, and the sheet's job is to ask about it rather than to add it
 * quietly.
 */
export function matchCatalog(
  query: string,
  spokenQuantity?: number,
  spokenUnit?: string,
): CatalogMatch {
  const text = normalise(query);
  const words = text.split(' ').filter(Boolean);

  // A quantity said inside the phrase beats one the model reported separately:
  // it is the customer's own words rather than an interpretation of them.
  const read = readQuantity(text);
  const quantity = read?.quantity ?? spokenQuantity ?? 1;
  const unit = read?.unit ?? spokenUnit;

  const base = { query: query.trim(), quantity, unit };

  for (const entry of CATALOG) {
    if (entry.aliases.some(alias => alias === text)) {
      return { ...base, productId: entry.id, productName: entry.name, confidence: 'high' };
    }
  }

  // The item word among the quantity words: "do kilo tamatar" is tomatoes.
  for (const entry of CATALOG) {
    if (entry.aliases.some(alias => words.includes(alias))) {
      return { ...base, productId: entry.id, productName: entry.name, confidence: 'high' };
    }
  }

  for (const entry of CATALOG) {
    if (entry.aliases.some(alias => alias.length >= 4 && text.includes(alias))) {
      return { ...base, productId: entry.id, productName: entry.name, confidence: 'medium' };
    }
  }

  for (const entry of CATALOG) {
    const near = entry.aliases.some(
      alias =>
        alias.length >= 4 && words.some(word => word.length >= 4 && withinTwoEdits(word, alias)),
    );
    if (near) {
      return { ...base, productId: entry.id, productName: entry.name, confidence: 'medium' };
    }
  }

  // Heard, but not sold here. Returned rather than dropped so the sheet can
  // show it greyed out — a silently missing item is how an order arrives short.
  return { ...base, confidence: 'low' };
}

/** Matches a whole parsed order. */
export function matchOrder(
  items: readonly { query: string; quantity?: number; unit?: string }[],
): CatalogMatch[] {
  return items.map(item => matchCatalog(item.query, item.quantity, item.unit));
}

/**
 * The order's overall confidence, taken from its weakest item.
 *
 * An order is exactly as trustworthy as the item you are least sure about:
 * averaging would let four confident matches carry one wrong one straight past
 * the customer.
 */
export function orderConfidence(matches: readonly CatalogMatch[]): MatchConfidence {
  if (matches.length === 0) return 'low';
  if (matches.some(match => match.confidence === 'low')) return 'low';
  if (matches.some(match => match.confidence === 'medium')) return 'medium';
  return 'high';
}
