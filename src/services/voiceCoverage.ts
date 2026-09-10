import {
  matchCatalog,
  readQuantity,
  type CatalogMatch,
} from './voiceCatalog';

/**
 * Known grocery keywords across Urdu, Roman Urdu, Punjabi and English.
 * Used by the coverage auditor to detect whether any grocery clause in the
 * full transcript was overlooked by semantic extraction.
 */
const GROCERY_LEXICON: Record<string, readonly string[]> = {
  milk: ['doodh', 'dudh', 'dodh', 'milk', 'olpers', 'olper', 'milkpak', 'دودھ'],
  bread: ['bread', 'roti', 'double roti', 'dabal roti', 'بریڈ', 'ڈبل روٹی'],
  eggs: ['anday', 'ande', 'anda', 'egg', 'eggs', 'aanday', 'انڈے', 'انڈا'],
  sugar: ['cheeni', 'chini', 'chinni', 'sugar', 'چینی'],
  flour: ['atta', 'aata', 'ata', 'flour', 'chakki atta', 'آٹا'],
  rice: ['chawal', 'chaval', 'rice', 'basmati', 'چاول'],
  tea: ['chai', 'chaye', 'tea', 'patti', 'tapal', 'lipton', 'چائے', 'پتی'],
  oil: ['tel', 'oil', 'ghee', 'gheo', 'cooking oil', 'dalda', 'sufi', 'تیل', 'گھی'],
  detergent: ['surf', 'surf excel', 'surfexel', 'ariel', 'bonus', 'سرف', 'ایکسل'],
  cola: ['coke', 'coca cola', 'coca-cola', 'cocacola', 'pepsi', 'sprite', '7up', 'کوک', 'پیپسی'],
  tomato: ['tamatar', 'tamater', 'tomato', 'tomatoes', 'ٹماٹر'],
  banana: ['kela', 'kele', 'banana', 'bananas', 'کیلا', 'کیلے'],
  potato: ['aloo', 'alu', 'potato', 'potatoes', 'آلو'],
  onion: ['pyaz', 'piyaz', 'onion', 'onions', 'پیاز'],
  cucumber: ['kheera', 'khira', 'cucumber', 'کھیرا'],
  apple: ['seb', 'saib', 'apple', 'apples', 'سیب'],
  spinach: ['palak', 'paalak', 'saag', 'spinach', 'پالک', 'ساگ'],
  chicken: ['murghi', 'murgi', 'chicken', 'gosht', 'مرغی', 'گوشت'],
  lentils: ['dal', 'daal', 'chana', 'lentils', 'دال', 'چنا'],
  salt: ['namak', 'salt', 'نمک'],
  soap: ['soap', 'sabun', 'saban', 'lux', 'lifebuoy', 'safeguard', 'صابن'],
  shampoo: ['shampoo', 'head and shoulders', 'sunsilk', 'شیمپو'],
  biscuit: ['biscuit', 'biscuits', 'cookie', 'cookies', 'بسکٹ'],
  masala: ['masala', 'shan', 'national', 'chaat masala', 'مصالحہ'],
  yoghurt: ['dahi', 'yogurt', 'yoghurt', 'دہی'],
  ginger: ['adrak', 'ginger', 'ادرک'],
  garlic: ['lehsan', 'garlic', 'لہسن'],
};

export type CoverageReport = {
  isCovered: boolean;
  expectedGroceryCategories: string[];
  coveredCategories: string[];
  missingPhrases: string[];
};

/**
 * Normalizes text for keyword boundary matching.
 */
function clean(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pass 2 Coverage Check:
 * Compares extracted products against the whole transcript to verify that every
 * grocery-related phrase spoken by the customer was accounted for.
 */
export function auditTranscriptCoverage(
  transcript: string,
  extractedItems: readonly { query: string }[],
  unresolvedFragments: readonly string[] = [],
): CoverageReport {
  const normTranscript = clean(transcript);
  if (!normTranscript) {
    return {
      isCovered: true,
      expectedGroceryCategories: [],
      coveredCategories: [],
      missingPhrases: [],
    };
  }

  const accountedTexts = [
    ...extractedItems.map(item => clean(item.query)),
    ...unresolvedFragments.map(f => clean(f)),
  ];

  const words = normTranscript.split(' ');
  const expectedCategories: string[] = [];
  const missingPhrases: string[] = [];
  const coveredCategories: string[] = [];

  // Identify every grocery category mentioned in the transcript
  for (const [category, keywords] of Object.entries(GROCERY_LEXICON)) {
    let matchedKeyword: string | null = null;

    for (const kw of keywords) {
      const cleanKw = clean(kw);
      if (cleanKw.includes(' ')) {
        if (normTranscript.includes(cleanKw)) {
          matchedKeyword = cleanKw;
          break;
        }
      } else {
        if (words.includes(cleanKw)) {
          matchedKeyword = cleanKw;
          break;
        }
      }
    }

    if (matchedKeyword) {
      expectedCategories.push(category);

      // Check if this category is accounted for in extracted items or unresolved fragments
      const isAccounted = accountedTexts.some(accounted => {
        if (!accounted) return false;
        if (accounted.includes(matchedKeyword!) || matchedKeyword!.includes(accounted)) {
          return true;
        }
        return keywords.some(kw => accounted.includes(clean(kw)));
      });

      if (isAccounted) {
        coveredCategories.push(category);
      } else {
        // Extract surrounding context phrase from transcript
        const kwIndex = normTranscript.indexOf(matchedKeyword);
        const start = Math.max(0, normTranscript.lastIndexOf(' ', Math.max(0, kwIndex - 12)));
        let end = normTranscript.indexOf(' ', kwIndex + matchedKeyword.length + 12);
        if (end === -1) end = normTranscript.length;
        const phrase = normTranscript.slice(start, end).trim();
        missingPhrases.push(phrase || matchedKeyword);
      }
    }
  }

  return {
    isCovered: missingPhrases.length === 0,
    expectedGroceryCategories: expectedCategories,
    coveredCategories,
    missingPhrases,
  };
}

/**
 * Controlled single repair pass:
 * Takes missed phrases detected by the coverage audit and converts them into
 * CatalogMatches without dropping any item.
 */
export function repairMissingPhrases(
  missingPhrases: readonly string[],
): CatalogMatch[] {
  const repairs: CatalogMatch[] = [];
  const seenQueries = new Set<string>();

  for (const phrase of missingPhrases) {
    if (!phrase || seenQueries.has(phrase)) continue;
    seenQueries.add(phrase);

    const parsedQty = readQuantity(phrase);
    const match = matchCatalog(
      phrase,
      parsedQty?.quantity ?? 1,
      parsedQty?.unit,
    );
    repairs.push(match);
  }

  return repairs;
}
