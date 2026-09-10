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
  milk: ['دودھ', 'doodh', 'dudh', 'dodh', 'dood', 'milk', 'olpers', 'olper', 'milkpak', 'milk pack'],
  eggs: ['انڈے', 'انڈا', 'انڈوں', 'anday', 'ande', 'aanday', 'anda', 'egg', 'eggs'],
  bread: ['روٹی', 'ڈبل روٹی', 'بریڈ', 'bread', 'double roti', 'dabal roti', 'roti', 'dawn bread'],
  rice: ['چاول', 'chawal', 'chaval', 'chawel', 'rice', 'basmati'],
  flour: ['آٹا', 'aata', 'atta', 'ata', 'flour', 'chakki atta'],
  sugar: ['چینی', 'cheeni', 'chini', 'chinni', 'sugar'],
  tea: ['چائے', 'پتی', 'chai', 'chaye', 'chae', 'patti', 'tea', 'tapal', 'lipton'],
  oil: ['تیل', 'گھی', 'tel', 'ghee', 'gheo', 'oil', 'cooking oil', 'dalda', 'sufi'],
  yoghurt: ['دہی', 'dahi', 'dahee', 'yoghurt', 'yogurt', 'curd'],
  orange: ['سنترہ', 'مالٹا', 'santra', 'santara', 'malta', 'orange', 'oranges'],
  chicken: ['مرغی', 'گوشت', 'murghi', 'murgi', 'murghee', 'gosht', 'chicken'],
  lentils: ['دال', 'چنا', 'dal', 'daal', 'chana', 'lentil', 'lentils'],
  salt: ['نمک', 'namak', 'salt'],
  garlic: ['لہسن', 'lehsan', 'lasan', 'lehsun', 'garlic'],
  ginger: ['ادرک', 'adrak', 'adrakh', 'ginger'],
  surf: ['سرف', 'سرف ایکسل', 'surf', 'surf excel', 'surfexel', 'surf excel detergent', 'detergent', 'ariel', 'bonus'],
  coke: ['کوک', 'کوکا کولا', 'coke', 'coca cola', 'coca-cola', 'cocacola'],
  pepsi: ['پیپسی', 'pepsi', 'pepsi cola', '7up', 'sprite'],
  biscuit: ['بسکٹ', 'بسکوٹ', 'biscuit', 'biscuits', 'cookie', 'cookies'],
  soap: ['صابن', 'soap', 'lux', 'lifebuoy', 'safeguard'],
  shampoo: ['شیمپو', 'shampoo'],
  masala: ['مصالحہ', 'masala', 'shan masala', 'national masala'],
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
  surf: 'Surf Excel',
  coke: 'Coca-Cola',
  pepsi: 'Pepsi',
  biscuit: 'biscuits',
  soap: 'soap',
  shampoo: 'shampoo',
  masala: 'masala',
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

const UNITS: Record<string, string> = {
  kilo: 'kg', kg: 'kg', kgs: 'kg', 'کلو': 'kg',
  litre: 'litre', liter: 'litre', l: 'litre', 'لیٹر': 'litre',
  packet: 'packet', pack: 'packet', packets: 'packet', 'پیکٹ': 'packet',
  bottle: 'bottle', bottles: 'bottle', 'بوتل': 'bottle',
  dozen: 'dozen', darjan: 'dozen', 'درجن': 'dozen',
  piece: 'piece', pcs: 'piece', pc: 'piece', dana: 'piece', danay: 'piece', 'دانے': 'piece',
};

/** Reads a spoken quantity out of a phrase, or nothing if none was said. */
export function readQuantity(
  phrase: string,
): { quantity: number; unit?: string } | null {
  const words = normalise(phrase).split(' ');
  let detectedUnit: string | undefined;

  for (const word of words) {
    if (UNITS[word]) {
      detectedUnit = UNITS[word];
    }
  }

  for (const word of words) {
    const fraction = FOLDED_FRACTIONS.get(word);
    if (fraction) return { quantity: fraction.quantity, unit: detectedUnit ?? fraction.unit };
    const spoken = FOLDED_NUMBERS.get(word);
    if (spoken !== undefined) return { quantity: spoken, unit: detectedUnit };
    const digits = Number(word);
    if (Number.isFinite(digits) && digits > 0 && digits <= 99) {
      return { quantity: digits, unit: detectedUnit };
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
    if (best > allowance) return false;
    previous = current;
  }
  return previous[b.length] <= allowance;
}

/**
 * Matches one spoken request against the catalogue.
 */
export function matchCatalog(
  query: string,
  spokenQuantity?: number,
  spokenUnit?: string,
): CatalogMatch {
  const text = normalise(query);
  const words = text.split(' ').filter(Boolean);

  const read = readQuantity(text);
  const quantity = read?.quantity ?? spokenQuantity ?? 1;
  const unit = read?.unit ?? spokenUnit;

  const base = { query: query.trim(), quantity, unit };

  for (const entry of CATALOG) {
    if (entry.aliases.some(alias => alias === text)) {
      return { ...base, productId: entry.id, productName: entry.name, confidence: 'high' };
    }
  }

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

  for (const entry of UNSTOCKED) {
    const hit =
      entry.aliases.some(alias => alias === text) ||
      entry.aliases.some(alias => words.includes(alias)) ||
      entry.aliases.some(alias => alias.length >= 4 && text.includes(alias));
    if (hit) return { ...base, confidence: 'low', unstocked: entry.name };
  }

  return { ...base, confidence: 'low' };
}

/* -------------------------------------------------------------------------- */
/* Reading the sentence itself                                                */
/* -------------------------------------------------------------------------- */

interface ExtractedQuantity {
  quantity: number;
  unit?: string;
  startIndex: number;
  endIndex: number;
  isCorrection?: boolean;
}

const CONJUNCTIONS = new Set([
  'aur', 'te', 'phir', 'bhi', 'bas', 'acha', 'theek', 'hai', 'haan', 'or', 'and', 'then',
  'اور', 'تے', 'پھر', 'بھی', 'بس', 'اچھا', 'ٹھیک', 'ہے', 'ہاں',
]);

function findQuantitiesInInterval(
  words: readonly string[],
  start: number,
  end: number,
): ExtractedQuantity[] {
  const result: ExtractedQuantity[] = [];
  let i = start;

  while (i < end) {
    // 1. Customer self-correction: "doodh do nahi teen", "sorry 4", "نہیں ۳"
    if (words[i] === 'nahi' || words[i] === 'actually' || words[i] === 'sorry' || words[i] === 'نہیں') {
      for (let j = i + 1; j < end && j < i + 3; j += 1) {
        const spoken = FOLDED_NUMBERS.get(words[j]);
        const num = spoken !== undefined ? spoken : Number(words[j]);
        if (Number.isFinite(num) && num > 0 && num <= 99) {
          let unit: string | undefined;
          let endIdx = j + 1;
          if (j + 1 < end && UNITS[words[j + 1]]) {
            unit = UNITS[words[j + 1]];
            endIdx = j + 2;
          }
          result.push({ quantity: num, unit, startIndex: i, endIndex: endIdx, isCorrection: true });
          i = endIdx;
          break;
        }
        const frac = FOLDED_FRACTIONS.get(words[j]);
        if (frac) {
          let unit: string | undefined = frac.unit;
          let endIdx = j + 1;
          if (j + 1 < end && UNITS[words[j + 1]]) {
            unit = UNITS[words[j + 1]];
            endIdx = j + 2;
          }
          result.push({ quantity: frac.quantity, unit, startIndex: i, endIndex: endIdx, isCorrection: true });
          i = endIdx;
          break;
        }
      }
      i += 1;
      continue;
    }

    // 2. Darjan / dozen: "aik darjan", "2 darjan", or standalone "darjan"
    if (words[i] === 'darjan' || words[i] === 'dozen' || words[i] === 'درجن') {
      result.push({ quantity: 12, unit: 'dozen', startIndex: i, endIndex: i + 1 });
      i += 1;
      continue;
    }
    if (i + 1 < end && (words[i + 1] === 'darjan' || words[i + 1] === 'dozen' || words[i + 1] === 'درجن')) {
      const prev = FOLDED_NUMBERS.get(words[i]) ?? Number(words[i]);
      const qty = Number.isFinite(prev) && prev > 0 ? prev * 12 : 12;
      result.push({ quantity: qty, unit: 'dozen', startIndex: i, endIndex: i + 2 });
      i += 2;
      continue;
    }

    // 3. Fraction: "aadha kilo", "paao"
    const frac = FOLDED_FRACTIONS.get(words[i]);
    if (frac) {
      let unit: string | undefined = frac.unit;
      let endIdx = i + 1;
      if (i + 1 < end && UNITS[words[i + 1]]) {
        unit = UNITS[words[i + 1]];
        endIdx = i + 2;
      }
      result.push({ quantity: frac.quantity, unit, startIndex: i, endIndex: endIdx });
      i = endIdx;
      continue;
    }

    // 4. Regular number or spoken word: "do kilo", "chay", "2"
    const spoken = FOLDED_NUMBERS.get(words[i]);
    const num = spoken !== undefined ? spoken : Number(words[i]);
    if (Number.isFinite(num) && num > 0 && num <= 99) {
      let unit: string | undefined;
      let endIdx = i + 1;
      if (i + 1 < end && UNITS[words[i + 1]]) {
        unit = UNITS[words[i + 1]];
        endIdx = i + 2;
      }
      result.push({ quantity: num, unit, startIndex: i, endIndex: endIdx });
      i = endIdx;
      continue;
    }

    i += 1;
  }

  return result;
}

/**
 * Finds every product named anywhere in a spoken sentence.
 */
export function scanTranscript(transcript: string): CatalogMatch[] {
  const text = normalise(transcript);
  if (!text) return [];
  const words = text.split(' ').filter(Boolean);

  type Hit = { entry: CatalogEntry; at: number; phraseLength: number; said: string; confidence: MatchConfidence };
  const hits: Hit[] = [];
  const found = new Set<string>();

  for (let i = 0; i < words.length; i += 1) {
    const pair = i + 1 < words.length ? `${words[i]} ${words[i + 1]}` : null;
    for (const entry of CATALOG) {
      if (found.has(entry.id)) continue;
      if (pair && entry.aliases.includes(pair)) {
        hits.push({ entry, at: i, phraseLength: 2, said: pair, confidence: 'high' });
        found.add(entry.id);
        break;
      }
      if (entry.aliases.includes(words[i])) {
        hits.push({ entry, at: i, phraseLength: 1, said: words[i], confidence: 'high' });
        found.add(entry.id);
        break;
      }
    }
  }

  for (let i = 0; i < words.length; i += 1) {
    const pair = i + 1 < words.length ? `${words[i]} ${words[i + 1]}` : null;
    for (const entry of UNSTOCKED) {
      if (found.has(entry.id)) continue;
      if (pair && entry.aliases.includes(pair)) {
        hits.push({ entry, at: i, phraseLength: 2, said: pair, confidence: 'low' });
        found.add(entry.id);
        break;
      }
      if (entry.aliases.includes(words[i])) {
        hits.push({ entry, at: i, phraseLength: 1, said: words[i], confidence: 'low' });
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
        hits.push({ entry, at: i, phraseLength: 1, said: word, confidence: 'medium' });
        found.add(entry.id);
        break;
      }
    }
  }

  hits.sort((a, b) => a.at - b.at);

  const assignedQuantities = new Map<number, { quantity: number; unit?: string }>();

  // Partition the sentence into N + 1 intervals around the identified hits
  const intervals: ExtractedQuantity[][] = [];
  for (let k = 0; k <= hits.length; k += 1) {
    const start = k === 0 ? 0 : hits[k - 1].at + hits[k - 1].phraseLength;
    const end = k === hits.length ? words.length : hits[k].at;
    intervals.push(start < end ? findQuantitiesInInterval(words, start, end) : []);
  }

  // Pass 1: Customer self-corrections override earlier mentioned quantities
  for (let k = 1; k <= hits.length; k += 1) {
    const correction = intervals[k].find(q => q.isCorrection);
    if (correction) {
      assignedQuantities.set(k - 1, { quantity: correction.quantity, unit: correction.unit });
    }
  }

  // Pass 2: Boundary intervals (Interval 0 -> prefix for hit 0, Interval N -> postfix for hit N-1)
  if (!assignedQuantities.has(0) && intervals[0].length > 0) {
    const lastQ = intervals[0][intervals[0].length - 1];
    assignedQuantities.set(0, { quantity: lastQ.quantity, unit: lastQ.unit });
  }
  if (hits.length > 0 && !assignedQuantities.has(hits.length - 1) && intervals[hits.length].length > 0) {
    const firstQ = intervals[hits.length][0];
    assignedQuantities.set(hits.length - 1, { quantity: firstQ.quantity, unit: firstQ.unit });
  }

  // Pass 3: Multi-quantity intervals (Interval k has >= 2 quantities: first belongs to k-1, last to k)
  for (let k = 1; k < hits.length; k += 1) {
    const qs = intervals[k].filter(q => !q.isCorrection);
    if (qs.length >= 2) {
      if (!assignedQuantities.has(k - 1)) {
        assignedQuantities.set(k - 1, { quantity: qs[0].quantity, unit: qs[0].unit });
      }
      if (!assignedQuantities.has(k)) {
        assignedQuantities.set(k, { quantity: qs[qs.length - 1].quantity, unit: qs[qs.length - 1].unit });
      }
    }
  }

  // Pass 4: Backward resolution for single-quantity intervals
  // If hit k already has a quantity, a quantity in interval k must belong to hit k-1.
  for (let k = hits.length - 1; k >= 1; k -= 1) {
    const qs = intervals[k].filter(q => !q.isCorrection);
    if (qs.length === 1) {
      const q = qs[0];
      if (assignedQuantities.has(k) && !assignedQuantities.has(k - 1)) {
        assignedQuantities.set(k - 1, { quantity: q.quantity, unit: q.unit });
      }
    }
  }

  // Pass 5: Forward resolution for single-quantity intervals
  // If hit k-1 already has a quantity, a quantity in interval k must belong to hit k.
  for (let k = 1; k < hits.length; k += 1) {
    const qs = intervals[k].filter(q => !q.isCorrection);
    if (qs.length === 1) {
      const q = qs[0];
      if (assignedQuantities.has(k - 1) && !assignedQuantities.has(k)) {
        assignedQuantities.set(k, { quantity: q.quantity, unit: q.unit });
      }
    }
  }

  // Pass 6: Conjunctions and proximity for any remaining unassigned items
  for (let k = 1; k < hits.length; k += 1) {
    const qs = intervals[k].filter(q => !q.isCorrection);
    if (qs.length === 1) {
      const q = qs[0];
      const prevUnassigned = !assignedQuantities.has(k - 1);
      const nextUnassigned = !assignedQuantities.has(k);
      if (prevUnassigned && !nextUnassigned) {
        assignedQuantities.set(k - 1, { quantity: q.quantity, unit: q.unit });
      } else if (!prevUnassigned && nextUnassigned) {
        assignedQuantities.set(k, { quantity: q.quantity, unit: q.unit });
      } else if (prevUnassigned && nextUnassigned) {
        let hasConjunctionAfter = false;
        for (let w = q.endIndex; w < hits[k].at; w += 1) {
          if (CONJUNCTIONS.has(words[w])) {
            hasConjunctionAfter = true;
            break;
          }
        }
        let hasConjunctionBefore = false;
        for (let w = hits[k - 1].at + hits[k - 1].phraseLength; w < q.startIndex; w += 1) {
          if (CONJUNCTIONS.has(words[w])) {
            hasConjunctionBefore = true;
            break;
          }
        }
        if (hasConjunctionAfter && !hasConjunctionBefore) {
          assignedQuantities.set(k - 1, { quantity: q.quantity, unit: q.unit });
        } else if (hasConjunctionBefore && !hasConjunctionAfter) {
          assignedQuantities.set(k, { quantity: q.quantity, unit: q.unit });
        } else {
          const distPrev = q.startIndex - (hits[k - 1].at + hits[k - 1].phraseLength);
          const distNext = hits[k].at - q.endIndex;
          if (distPrev <= distNext) {
            assignedQuantities.set(k - 1, { quantity: q.quantity, unit: q.unit });
          } else {
            assignedQuantities.set(k, { quantity: q.quantity, unit: q.unit });
          }
        }
      }
    }
  }

  const unstocked = new Set(UNSTOCKED.map(entry => entry.id));

  return hits.map((hit, k) => {
    const read = assignedQuantities.get(k);
    const base = {
      query: hit.said,
      quantity: read?.quantity ?? 1,
      unit: read?.unit,
      confidence: hit.confidence,
    };
    return unstocked.has(hit.entry.id)
      ? { ...base, unstocked: hit.entry.name }
      : {
          ...base,
          productId: hit.entry.id,
          productName: hit.entry.name,
        };
  });
}

/**
 * Reads the order with full transcript coverage validation.
 */
export function readOrder(
  transcript: string,
  items: readonly { query: string; quantity?: number; unit?: string }[],
  unresolvedFragments?: readonly string[],
): CatalogMatch[] {
  const parsed = matchOrder(items);
  const already = new Set(
    parsed.map(match => match.productId).filter(Boolean) as string[],
  );
  const named = new Set(
    parsed.map(match => match.unstocked).filter(Boolean) as string[],
  );
  const missed = scanTranscript(transcript).filter(match =>
    match.productId
      ? !already.has(match.productId)
      : !named.has(match.unstocked ?? ''),
  );

  let result = [...parsed, ...missed];

  // Import coverage validation dynamically or directly
  try {
    const { auditTranscriptCoverage, repairMissingPhrases } = require('./voiceCoverage');
    const coverage = auditTranscriptCoverage(transcript, result, unresolvedFragments);
    if (!coverage.isCovered && coverage.missingPhrases.length > 0) {
      const repairs = repairMissingPhrases(coverage.missingPhrases);
      for (const repair of repairs) {
        if (repair.productId && !already.has(repair.productId)) {
          already.add(repair.productId);
          result.push(repair);
        } else if (repair.unstocked && !named.has(repair.unstocked)) {
          named.add(repair.unstocked);
          result.push(repair);
        }
      }
    }
  } catch {}

  // Include unresolved fragments so the user sees everything heard
  if (unresolvedFragments && unresolvedFragments.length > 0) {
    for (const frag of unresolvedFragments) {
      if (!frag.trim()) continue;
      const alreadyIncluded = result.some(m => m.query.toLowerCase() === frag.toLowerCase());
      if (!alreadyIncluded) {
        result.push({
          query: frag.trim(),
          quantity: 1,
          confidence: 'low',
        });
      }
    }
  }

  return result;
}

/** Matches a whole parsed order. */
export function matchOrder(
  items: readonly { query: string; quantity?: number; unit?: string }[],
): CatalogMatch[] {
  return items.map(item => matchCatalog(item.query, item.quantity, item.unit));
}

/**
 * The order's overall confidence, taken from its weakest item.
 */
export function orderConfidence(matches: readonly CatalogMatch[]): MatchConfidence {
  if (matches.length === 0) return 'low';
  if (matches.some(match => match.confidence === 'low')) return 'low';
  if (matches.some(match => match.confidence === 'medium')) return 'medium';
  return 'high';
}
