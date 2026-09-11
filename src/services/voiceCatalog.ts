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
  // Stocked today. Urdu script first, because that is what Whisper actually
  // returns for Urdu speech.
  tomato: [
    'ٹماٹر', 'تماتر',
    'tamatar', 'tamater', 'tamatr', 'tamaatar', 'timatar',
    'tomato', 'tomatoes',
  ],
  banana: [
    'کیلا', 'کیلے', 'کیلہ',
    'kela', 'kele', 'kaila', 'kaile', 'keela',
    'banana', 'bananas',
  ],
  spinach: [
    'پالک', 'ساگ',
    'palak', 'paalak', 'saag', 'sag',
    'spinach', 'greens',
  ],
  apple: [
    'سیب', 'سیو',
    'seb', 'saib', 'sev', 'seo',
    'apple', 'apples',
  ],
  cucumber: [
    'کھیرا', 'کھیرے', 'ککڑی',
    'kheera', 'khira', 'kheere', 'khera', 'kakri', 'kakdi',
    'cucumber', 'cucumbers',
  ],

  // Not stocked yet. Carried so that adding one to freshPicks is a one-line
  // change rather than a translation exercise — CATALOG only ever exposes what
  // is actually on the shelf.
  potato: ['آلو', 'aloo', 'alu', 'aalu', 'potato', 'potatoes'],
  onion: ['پیاز', 'pyaz', 'piyaz', 'pyaaz', 'pyaj', 'onion', 'onions'],
  milk: ['دودھ', 'doodh', 'dudh', 'dodh', 'dood', 'milk'],
  eggs: ['انڈے', 'انڈا', 'انڈوں', 'anday', 'ande', 'aanday', 'anda', 'egg', 'eggs'],
  bread: ['روٹی', 'ڈبل روٹی', 'بریڈ', 'bread', 'double roti', 'dabal roti', 'roti'],
  rice: ['چاول', 'chawal', 'chaval', 'chawel', 'rice'],
  flour: ['آٹا', 'aata', 'atta', 'ata', 'flour'],
  sugar: ['چینی', 'cheeni', 'chini', 'chinni', 'sugar'],
  tea: ['چائے', 'پتی', 'chai', 'chaye', 'chae', 'patti', 'tea'],
  oil: ['تیل', 'گھی', 'tel', 'ghee', 'gheo', 'oil', 'cooking oil'],
  yoghurt: ['دہی', 'dahi', 'dahee', 'yoghurt', 'yogurt', 'curd'],
  orange: ['سنترہ', 'مالٹا', 'santra', 'santara', 'malta', 'orange', 'oranges'],
  chicken: ['مرغی', 'گوشت', 'murghi', 'murgi', 'murghee', 'gosht', 'chicken'],
  lentils: ['دال', 'چنا', 'dal', 'daal', 'chana', 'lentil', 'lentils'],
  salt: ['نمک', 'namak', 'salt'],
  garlic: ['لہسن', 'lehsan', 'lasan', 'lehsun', 'garlic'],
  ginger: ['ادرک', 'adrak', 'adrakh', 'ginger'],
};

/** What to call a product we know the word for but do not sell. */
const UNSTOCKED_LABELS: Record<string, string> = {
  potato: 'potatoes',
  onion: 'onions',
  milk: 'milk',
  eggs: 'eggs',
  bread: 'bread',
  rice: 'rice',
  flour: 'flour',
  sugar: 'sugar',
  tea: 'tea',
  oil: 'cooking oil',
  yoghurt: 'yoghurt',
  orange: 'oranges',
  chicken: 'chicken',
  lentils: 'lentils',
  salt: 'salt',
  garlic: 'garlic',
  ginger: 'ginger',
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
  // Folded on the way in, so the comparison at match time is fold-to-fold. A
  // fold applied to only one side is worse than no fold at all: it moves which
  // spellings fail rather than fixing any of them.
  return {
    id: item.id,
    name: item.name,
    aliases: [...aliases].map(normalise),
  };
});

/**
 * Words we understand and cannot sell.
 *
 * Every alias key that no stocked product claims. The list was already here so
 * that putting eggs on the shelf stays a one-line change; it turns out to be
 * exactly what is needed to tell a customer *why* their eggs are not in the
 * cart, instead of implying we did not hear them.
 */
const UNSTOCKED: readonly CatalogEntry[] = (() => {
  const stocked = new Set(
    freshPicks.flatMap(item => item.name.toLowerCase().split(/\s+/)),
  );
  return Object.entries(ALIASES)
    .filter(([key]) => !stocked.has(key))
    .map(([key, aliases]) => ({
      id: key,
      name: UNSTOCKED_LABELS[key] ?? key,
      aliases: aliases.map(normalise),
    }));
})();

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
  /**
   * Set when we understood the word perfectly and simply do not sell it.
   *
   * "We don't stock eggs yet" and "we couldn't make that out" are different
   * things to be told, and only one of them is worth saying the order again
   * for. Without this they were the same unmatched item and got the same
   * shrug, which reads as the app failing when in fact it understood.
   */
  unstocked?: string;
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
  // Roman, in the spellings people actually type and Whisper actually returns.
  aik: 1, ek: 1, ik: 1, ikk: 1, one: 1,
  do: 2, doo: 2, dou: 2, two: 2,
  teen: 3, tin: 3, tean: 3, trai: 3, three: 3,
  chaar: 4, char: 4, chaar4: 4, four: 4,
  paanch: 5, panch: 5, panj: 5, panjh: 5, five: 5,
  chay: 6, che: 6, chhe: 6, chey: 6, six: 6,
  saat: 7, sat: 7, satt: 7, seven: 7,
  aath: 8, ath: 8, atth: 8, eight: 8,
  nau: 9, no: 9, nau9: 9, nine: 9,
  das: 10, dus: 10, ten: 10,
  darjan: 12, dozen: 12,

  // Urdu and Shahmukhi Punjabi. Whisper returns Urdu speech in Urdu script, so
  // without these a spoken "دو کلو" carries no quantity at all and the order
  // silently becomes one of everything.
  'ایک': 1,
  'دو': 2,
  'تین': 3,
  'چار': 4,
  'پانچ': 5, 'پنج': 5,
  'چھ': 6, 'چھے': 6,
  'سات': 7,
  'آٹھ': 8,
  'نو': 9,
  'دس': 10,
  'درجن': 12,
};

/** Words that carry a quantity of their own. */
const FRACTIONS: Record<string, { quantity: number; unit: string }> = {
  paao: { quantity: 0.25, unit: 'kg' },
  pao: { quantity: 0.25, unit: 'kg' },
  'پاؤ': { quantity: 0.25, unit: 'kg' },
  'پاو': { quantity: 0.25, unit: 'kg' },
  aadha: { quantity: 0.5, unit: 'kg' },
  adha: { quantity: 0.5, unit: 'kg' },
  adh: { quantity: 0.5, unit: 'kg' },
  half: { quantity: 0.5, unit: 'kg' },
  'آدھا': { quantity: 0.5, unit: 'kg' },
  'آدھ': { quantity: 0.5, unit: 'kg' },
};

/**
 * The number tables, folded the same way the input is.
 *
 * Built once at load rather than folded per lookup: "آدھا" normalises to
 * "ادھا", so an unfolded key never matches its own word — the table looks
 * right and silently answers nothing.
 */
const FOLDED_NUMBERS = new Map<string, number>(
  Object.entries(NUMBERS).map(([word, value]) => [normalise(word), value]),
);
const FOLDED_FRACTIONS = new Map<string, { quantity: number; unit: string }>(
  Object.entries(FRACTIONS).map(([word, value]) => [normalise(word), value]),
);

/** Reads a spoken quantity out of a phrase, or nothing if none was said. */
export function readQuantity(
  phrase: string,
): { quantity: number; unit?: string } | null {
  const words = normalise(phrase).split(' ');
  for (const word of words) {
    const fraction = FOLDED_FRACTIONS.get(word);
    if (fraction) return fraction;
    const spoken = FOLDED_NUMBERS.get(word);
    if (spoken !== undefined) return { quantity: spoken };
    const digits = Number(word);
    if (Number.isFinite(digits) && digits > 0 && digits <= 99) {
      return { quantity: digits };
    }
  }
  return null;
}

/**
 * Urdu written two ways is still one word.
 *
 * Arabic script offers several encodings of the same letter and Whisper does
 * not pick consistently between them: ي and ی are both "yeh", ك and ک both
 * "kaf", ه and ہ both "heh". Two strings that a reader would call identical
 * compare as different, so an alias list matches nothing while looking
 * completely correct — which is the worst kind of bug to stare at.
 *
 * Diacritics go the same way. They are optional in written Urdu, so the same
 * word arrives with and without them depending on nothing in particular.
 */
function foldArabicScript(value: string): string {
  return (
    value
      // Harakat, hamza marks and superscript alef: optional, and inconsistently
      // present.
      .replace(/[\u064B-\u0655\u0670]/g, '')
      // Zero-width joiners and tatweel: invisible, and they break equality.
      .replace(/[\u200B-\u200F\u0640]/g, '')
      .replace(/[\u064A\u0649]/g, '\u06CC')
      .replace(/\u0643/g, '\u06A9')
      .replace(/[\u0647\u06C3\u0629]/g, '\u06C1')
      .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
      .replace(/\u0624/g, '\u0648')
      .replace(/\u0626/g, '\u06CC')
  );
}

/**
 * Urdu and Arabic-Indic digits, folded to the ones `Number()` understands.
 *
 * "۲ کلو" is two kilos. Left alone it is not a number to JavaScript at all, and
 * the quantity is silently lost.
 */
function foldDigits(value: string): string {
  return value.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, digit => {
    const code = digit.codePointAt(0)!;
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/** Lowercase, unpunctuated, single-spaced. Everything compares in this form. */
function normalise(value: string): string {
  return foldDigits(foldArabicScript(value))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein, with an allowance that scales with length.
 *
 * A flat two edits is too generous for short words, and grocery words are
 * short. "namak" and "palak" are two edits apart, so salt matched spinach —
 * a customer asking for one receives the other, which is precisely the
 * substitution this whole layer exists to prevent. Five letters or fewer get
 * one edit; longer words get two, where the useful cases are a dropped vowel
 * or a doubled consonant.
 */
function isNearMiss(a: string, b: string): boolean {
  const allowance = Math.min(a.length, b.length) <= 5 ? 1 : 2;
  if (Math.abs(a.length - b.length) > allowance) return false;
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
    if (best > allowance) return false;
    previous = current;
  }
  return previous[b.length] <= allowance;
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
        alias.length >= 4 && words.some(word => word.length >= 4 && isNearMiss(word, alias)),
    );
    if (near) {
      return { ...base, productId: entry.id, productName: entry.name, confidence: 'medium' };
    }
  }

  // Understood, and not on the shelf. Worth saying so by name: the customer
  // asked for something real and the answer is about our stock, not their
  // pronunciation.
  for (const entry of UNSTOCKED) {
    const hit =
      entry.aliases.some(alias => alias === text) ||
      entry.aliases.some(alias => words.includes(alias)) ||
      entry.aliases.some(alias => alias.length >= 4 && text.includes(alias));
    if (hit) return { ...base, confidence: 'low', unstocked: entry.name };
  }

  // Heard, but not understood. Returned rather than dropped so the sheet can
  // show it greyed out — a silently missing item is how an order arrives short.
  return { ...base, confidence: 'low' };
}

/* -------------------------------------------------------------------------- */
/* Reading the sentence itself                                                */
/* -------------------------------------------------------------------------- */

/**
 * How far back from a product word a quantity may sit.
 *
 * "do kilo tamatar" is two words; "mujhe do kilo tamatar" is three. Beyond
 * that a number belongs to something else in the sentence, and reaching for it
 * is how one item's quantity ends up on another.
 */
const QUANTITY_LOOKBACK = 3;

function quantityBefore(
  words: readonly string[],
  at: number,
  taken: ReadonlySet<number>,
): { quantity: number; unit?: string } | null {
  for (let i = at - 1; i >= 0 && i >= at - QUANTITY_LOOKBACK; i -= 1) {
    // Another product's own word. Whatever is behind it is that item's
    // quantity, not this one's.
    if (taken.has(i)) return null;
    const word = words[i];
    const fraction = FOLDED_FRACTIONS.get(word);
    if (fraction) return fraction;
    const spoken = FOLDED_NUMBERS.get(word);
    if (spoken !== undefined) return { quantity: spoken };
    const digits = Number(word);
    if (Number.isFinite(digits) && digits > 0 && digits <= 99) {
      return { quantity: digits };
    }
  }
  return null;
}

/**
 * Finds every product named anywhere in a spoken sentence.
 *
 * `matchCatalog` answers "which product is this phrase", which is the right
 * question for a list the model has already split up and the wrong one for a
 * sentence: asked about "کیلا اور ٹماٹر" it returns tomatoes, and the bananas
 * are simply gone. One phrase, one answer.
 *
 * This walks the words instead and takes every product it passes, which is
 * what makes it usable as a floor under the model. When the parse comes back
 * empty — a Groq outage, an exhausted quota, a malformed answer, a sentence it
 * declined to split — the customer's own words still contain "کیلا" and
 * "ٹماٹر", and the catalogue has known both all along. Nothing found was the
 * one outcome that was never true.
 *
 * Exact words only, then fuzzy for what is left. A sentence is long enough
 * that a loose match somewhere in it is nearly guaranteed, so the loose pass
 * runs only against products the exact pass did not already find, and never
 * returns 'high'.
 */
export function scanTranscript(transcript: string): CatalogMatch[] {
  const text = normalise(transcript);
  if (!text) return [];
  const words = text.split(' ').filter(Boolean);

  type Hit = { entry: CatalogEntry; at: number; said: string; confidence: MatchConfidence };
  const hits: Hit[] = [];
  // One hit per product. "tamatar ... tamatar" is one person saying the same
  // thing twice, not two separate items.
  const found = new Set<string>();

  for (let i = 0; i < words.length; i += 1) {
    const pair = i + 1 < words.length ? `${words[i]} ${words[i + 1]}` : null;
    for (const entry of CATALOG) {
      if (found.has(entry.id)) continue;
      // Two-word aliases first, so "double roti" is not read as "roti".
      if (pair && entry.aliases.includes(pair)) {
        hits.push({ entry, at: i, said: pair, confidence: 'high' });
        found.add(entry.id);
        break;
      }
      if (entry.aliases.includes(words[i])) {
        hits.push({ entry, at: i, said: words[i], confidence: 'high' });
        found.add(entry.id);
        break;
      }
    }
  }

  // Things we understand and do not sell, so a sentence naming them can say
  // so by name rather than leaving the customer to notice the gap.
  for (let i = 0; i < words.length; i += 1) {
    for (const entry of UNSTOCKED) {
      if (found.has(entry.id)) continue;
      if (entry.aliases.includes(words[i])) {
        hits.push({ entry, at: i, said: words[i], confidence: 'low' });
        found.add(entry.id);
        break;
      }
    }
  }

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    if (word.length < 4) continue;
    for (const entry of CATALOG) {
      if (found.has(entry.id)) continue;
      const near = entry.aliases.some(
        alias => alias.length >= 4 && isNearMiss(word, alias),
      );
      if (near) {
        hits.push({ entry, at: i, said: word, confidence: 'medium' });
        found.add(entry.id);
        break;
      }
    }
  }

  // Back into the order they were said in, so the cart fills the way the
  // sentence ran.
  hits.sort((a, b) => a.at - b.at);
  const taken = new Set(hits.map(hit => hit.at));

  const unstocked = new Set(UNSTOCKED.map(entry => entry.id));

  return hits.map(hit => {
    const read = quantityBefore(words, hit.at, taken);
    const base = {
      query: hit.said,
      quantity: read?.quantity ?? 1,
      unit: read?.unit,
      confidence: hit.confidence,
    };
    // An unstocked hit is not a product: it carries a name to say out loud and
    // deliberately no id, so nothing downstream can put it in a cart.
    return unstocked.has(hit.entry.id)
      ? { ...base, unstocked: hit.entry.name }
      : {
          ...base,
          productId: hit.entry.id,
          productName: hit.entry.name,
        };
  });
}


/* -------------------------------------------------------------------------- */
/* Coverage                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Words that carry no product of their own.
 *
 * Everything here is either grammar, a unit, or a quantity — so a sentence made
 * entirely of these and matched products has been fully understood, and
 * anything left over is something the customer said that we did not take.
 *
 * Numbers and fractions are not listed: they already have tables, and
 * duplicating them here is how the two drift apart.
 */
const FILLER = new Set(
  [
    // Deliberately absent: wala/wali. They are how a size or a variant gets
    // said — "bara wala surf" is one thing somebody asked for — so treating
    // them as grammar splits a phrase we are supposed to hand back whole.
    // Urdu and Roman grammar around an order.
    'aur', 'or', 'ar', 'mujhe', 'mujhay', 'muje', 'mainu', 'menu',
    'chahiye', 'chahie', 'chaiye', 'chahida', 'de', 'do', 'dedo', 'dena',
    'dena', 'dedena', 'ka', 'ki', 'ke', 'kay', 'bhi',
    'please', 'plz', 'and', 'a', 'an', 'the', 'some', 'of', 'me', 'i', 'we',
    'want', 'need', 'give', 'get', 'bhej', 'bhejo', 'lao', 'la', 'chaida',
    'اور', 'مجھے', 'چاہیے', 'دے', 'دو', 'دیدو', 'کا', 'کی', 'کے', 'بھی',
    'لاؤ', 'بھیجو',
    // Units. A unit without a product is not an item anyone can be sold.
    'kilo', 'kilos', 'kg', 'kgs', 'gram', 'grams', 'g', 'litre', 'liter',
    'litres', 'liters', 'l', 'ml', 'packet', 'packets', 'pack', 'bottle',
    'bottles', 'dabba', 'dibba', 'thaila', 'piece', 'pieces', 'pcs',
    'کلو', 'گرام', 'لیٹر', 'پیکٹ', 'بوتل', 'ڈبہ', 'تھیلا',
  ].map(normalise),
);

/** A word that could be a product: not filler, not a number, long enough. */
function couldBeProduct(word: string): boolean {
  if (word.length < 3) return false;
  if (FILLER.has(word)) return false;
  if (FOLDED_NUMBERS.has(word) || FOLDED_FRACTIONS.has(word)) return false;
  if (Number.isFinite(Number(word))) return false;
  return true;
}

/**
 * What the customer said that nothing accounted for.
 *
 * The point is §26: never silently lose a word. A sentence that produced two
 * items and left "tarang bara wala" on the floor has not been understood — it
 * has been half understood, and the difference between saying so and showing a
 * confident list of two is the difference between a customer who can fix it and
 * a customer whose order arrives short.
 *
 * Returned as contiguous runs rather than loose words, because "bara wala surf"
 * is one thing somebody asked for and three unrelated chips is not a question
 * anyone can answer.
 */
export function unresolvedFragments(
  transcript: string,
  matches: readonly CatalogMatch[],
): string[] {
  const text = normalise(transcript);
  if (!text) return [];

  // Every word any match consumed, including the aliases behind the product it
  // resolved to: the transcript says "kela", the match says "Banana Premium",
  // and neither string contains the other.
  const consumed = new Set<string>();
  for (const match of matches) {
    for (const word of normalise(match.query).split(' ')) consumed.add(word);
    const entry = [...CATALOG, ...UNSTOCKED].find(
      candidate => candidate.id === match.productId || candidate.name === match.unstocked,
    );
    for (const alias of entry?.aliases ?? []) consumed.add(alias);
  }

  const runs: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length) runs.push(run.join(' '));
    run = [];
  };

  for (const word of text.split(' ').filter(Boolean)) {
    if (consumed.has(word) || !couldBeProduct(word)) {
      flush();
      continue;
    }
    run.push(word);
  }
  flush();

  return runs;
}

/**
 * Whether the sentence was understood well enough to skip the model.
 *
 * This is the free fast path and most orders take it. "Do kilo tamatar aur aik
 * kela" needs no LLM: the words are in the catalogue, the numbers are in the
 * tables, and nothing is left over. Calling a model to confirm that costs a
 * second of the customer's time and one of a small free quota, to agree with
 * an answer we already had.
 *
 * The bar is deliberately high. Anything left unaccounted for, or any match we
 * are not sure of, goes to the model — that is exactly the case a model is
 * better at than a table of aliases.
 */
export function isConfidentlyUnderstood(
  transcript: string,
  matches: readonly CatalogMatch[],
): boolean {
  const addable = matches.filter(match => match.productId);
  if (addable.length === 0) return false;
  if (addable.some(match => match.confidence !== 'high')) return false;
  return unresolvedFragments(transcript, matches).length === 0;
}

/**
 * The model's reading of the order, with the sentence as a floor under it.
 *
 * Neither source is trusted alone. The parse knows how to split a sentence and
 * which number belongs to which item, and it is also the part that can return
 * nothing at all — so anything it missed but the customer plainly said is
 * added from the scan, and its own items keep their quantities.
 *
 * Unmatched items from the parse are kept. "Heard, but not sold here" is
 * information the customer needs, and it is the one thing the scan cannot
 * report: it only ever finds things that are on the shelf.
 */
export function readOrder(
  transcript: string,
  items: readonly { query: string; quantity?: number; unit?: string }[],
): CatalogMatch[] {
  const parsed = matchOrder(items);
  const already = new Set(
    parsed.map(match => match.productId).filter(Boolean) as string[],
  );
  // Unstocked items dedupe by name, having no id to dedupe by — otherwise the
  // customer is told twice that we have no eggs.
  const named = new Set(
    parsed.map(match => match.unstocked).filter(Boolean) as string[],
  );
  const missed = scanTranscript(transcript).filter(match =>
    match.productId
      ? !already.has(match.productId)
      : !named.has(match.unstocked ?? ''),
  );
  return [...parsed, ...missed];
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
