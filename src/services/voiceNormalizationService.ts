/**
 * Voice Normalization Service for Pakistani Grocery Orders.
 *
 * The transcript produced by speech-to-text (Whisper) is only one noisy representation
 * of what the customer spoke. This service normalizes Urdu, Punjabi, Roman Urdu,
 * and English numbers, units, and quantity phrases without destroying the raw transcript.
 */

export type NormalizedTranscript = {
  original: string;
  normalized: string;
  tokens: string[];
};

export const NUMBER_WORDS: Record<string, number> = {
  // English
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,

  // Urdu / Roman Urdu / Punjabi
  ek: 1,
  aik: 1,
  ik: 1,
  yck: 1,
  yak: 1,
  do: 2,
  dou: 2,
  doh: 2,
  teen: 3,
  tin: 3,
  trai: 3,
  tre: 3,
  char: 4,
  chaar: 4,
  panch: 5,
  paanch: 5,
  panj: 5,
  chay: 6,
  che: 6,
  chhe: 6,
  chey: 6,
  saat: 7,
  sat: 7,
  aath: 8,
  ath: 8,
  nau: 9,
  nao: 9,
  no: 9,
  das: 10,
  dass: 10,

  // Urdu Script
  'ایک': 1,
  'دو': 2,
  'تین': 3,
  'چار': 4,
  'پانچ': 5,
  'چھ': 6,
  'سات': 7,
  'آٹھ': 8,
  'نو': 9,
  'دس': 10,

  // Urdu-Indic Digits
  '۰': 0,
  '۱': 1,
  '۲': 2,
  '۳': 3,
  '۴': 4,
  '۵': 5,
  '۶': 6,
  '۷': 7,
  '۸': 8,
  '۹': 9,
};

export const FRACTIONAL_QUANTITIES: { pattern: RegExp; quantity: number; unit?: string }[] = [
  { pattern: /\b(aadha|adha|adhaa|half)\s*(kilo|kg)\b/gi, quantity: 0.5, unit: 'kg' },
  { pattern: /\b(aadha|adha|adhaa|half)\s*(litre|liter|l)\b/gi, quantity: 0.5, unit: 'litre' },
  { pattern: /\b(aadha|adha|adhaa|half)\s*(dozen|darjan)\b/gi, quantity: 6, unit: 'unit' },
  { pattern: /\b(paao|pao|pawa|paaon)\s*(kilo|kg)?\b/gi, quantity: 0.25, unit: 'kg' },
  { pattern: /\b(dedh|dhai|sawa)\s*(kilo|kg)\b/gi, quantity: 1.5, unit: 'kg' },
  { pattern: /\b(darjan|dozen)\b/gi, quantity: 12, unit: 'unit' },
  { pattern: /آدھا\s*کلو/g, quantity: 0.5, unit: 'kg' },
  { pattern: /پاؤ/g, quantity: 0.25, unit: 'kg' },
  { pattern: /درجن/g, quantity: 12, unit: 'unit' },
];

/**
 * Normalizes a raw spoken transcript into a standardized query string.
 * Retains the original transcript intact.
 */
export function normalizeTranscript(raw: string): NormalizedTranscript {
  if (!raw || typeof raw !== 'string') {
    return { original: '', normalized: '', tokens: [] };
  }

  const original = raw.trim();
  let normalized = original.toLowerCase();

  // Normalize Unicode punctuation & special chars
  normalized = normalized
    .replace(/[،,۔.؟?!;:\-_/\\()"[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Convert Urdu-Indic digits to standard Arabic numerals
  normalized = normalized.replace(/[۰-۹]/g, digit => String(NUMBER_WORDS[digit] ?? digit));

  // Normalize common spoken Pakistani number words when followed by an item or standalone
  for (const [word, num] of Object.entries(NUMBER_WORDS)) {
    // Word boundary matching (handles Latin words and non-Latin Urdu words)
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'g');
    normalized = normalized.replace(regex, `$1${num}$2`);
  }

  // Normalize common quantity phrases
  for (const { pattern, quantity, unit } of FRACTIONAL_QUANTITIES) {
    normalized = normalized.replace(pattern, `${quantity}${unit ? ' ' + unit : ''}`);
  }

  // Normalize size expressions
  normalized = normalized
    .replace(/\b(bara|bari|bada|badi)\s+(wala|wali|pack)\b/gi, 'large')
    .replace(/\b(chota|choti)\s+(wala|wali|pack)\b/gi, 'small')
    .replace(/\b(family)\s+(pack|size)\b/gi, 'large');

  // Collapse excess whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  const tokens = normalized.split(/\s+/).filter(Boolean);

  return {
    original,
    normalized,
    tokens,
  };
}

/**
 * Checks if a string contains Urdu or Arabic script characters.
 */
export function isUrduScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * Splits unpunctuated continuous speech into distinct grocery item clauses.
 */
export function splitFastSpeech(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  // Split on conjunctions, punctuation, or when a number starts a new item
  const withConjunctions = text.replace(
    /(?<=[a-z\u0600-\u06FF])\s+(?=\d+\s+[a-z\u0600-\u06FF])/gi,
    ' aur ',
  );
  return withConjunctions
    .split(/\b(?:aur|and|or|phir|bhi|ke sath|with)\b|[,+؛،۔]/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Parses Urdu, Punjabi, or Roman Urdu quantities, numbers, and fractions into standard numbers.
 */
export function parseUrduQuantity(
  phrase: string,
): { quantity: number; unit?: string } | null {
  if (!phrase || typeof phrase !== 'string') return null;
  const norm = phrase.toLowerCase().trim();

  // Fractions & Pakistani measures
  if (/\b(aadha|adha|adhaa|half)\s*(kilo|kg)\b/i.test(norm) || norm === 'آدھا کلو') {
    return { quantity: 0.5, unit: 'kg' };
  }
  if (/\b(paao|pao|pawa|paaon)\b/i.test(norm) || norm === 'پاؤ') {
    return { quantity: 0.25, unit: 'kg' };
  }
  if (/\b(dedh|derh)\s*(kilo|kg)\b/i.test(norm)) {
    return { quantity: 1.5, unit: 'kg' };
  }
  if (/\b(dhai)\s*(kilo|kg)\b/i.test(norm)) {
    return { quantity: 2.5, unit: 'kg' };
  }
  if (/\b(aadha|adha|half)\s*(darjan|dozen)\b/i.test(norm)) {
    return { quantity: 6, unit: 'dozen' };
  }
  if (/\b(do|dou|2)\s*(darjan|dozen)\b/i.test(norm)) {
    return { quantity: 24, unit: 'dozen' };
  }
  if (/\b(ek|aik|1)?\s*(darjan|dozen)\b/i.test(norm) || norm === 'درجن') {
    return { quantity: 12, unit: 'dozen' };
  }

  // Exact word matches for numbers
  for (const [word, val] of Object.entries(NUMBER_WORDS)) {
    if (norm === word || norm.startsWith(`${word} `) || norm.endsWith(` ${word}`)) {
      return { quantity: val };
    }
  }

  // Numeric digits
  const match = norm.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/i);
  if (match) {
    return { quantity: parseFloat(match[1]), unit: match[2] };
  }

  return null;
}

