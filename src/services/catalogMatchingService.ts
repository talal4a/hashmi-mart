/**
 * Intelligent Catalog Matching Service for HashmiMart.
 *
 * Combines exact alias matching, token overlap, fuzzy string distance (Dice + Levenshtein),
 * Pakistani phonetic normalization, and variant candidate resolution.
 */

import { allGroceryProducts, freshPicks } from '../data/groceryHome';
import {
  PRODUCT_ALIASES,
  applyPhoneticCorrections,
  type ProductAliasEntry,
} from './groceryAliasService';
import { normalizeTranscript } from './voiceNormalizationService';

export type MatchConfidence = 'high' | 'medium' | 'low';

export type CatalogMatchResult = {
  productId?: string;
  productName?: string;
  canonicalName?: string;
  unitPrice?: number;
  quantity: number;
  unit?: string;
  confidence: MatchConfidence;
  score: number;
  query: string;
  rawPhrase?: string;
  sizeHint?: string;
  needsVariantConfirmation?: boolean;
  candidateVariants?: readonly { size: string; productId: string }[];
  isUnresolved?: boolean;
  unstocked?: string;
};

/** Levenshtein distance between two strings */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/** Dice coefficient based on character bigrams */
export function diceCoefficient(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return a === b ? 1.0 : 0;

  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.slice(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
    }
    return bigrams;
  };

  const aBigrams = getBigrams(a);
  const bBigrams = getBigrams(b);

  let intersection = 0;
  for (const [bigram, count] of aBigrams.entries()) {
    if (bBigrams.has(bigram)) {
      intersection += Math.min(count, bBigrams.get(bigram)!);
    }
  }

  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

/**
 * Calculates string similarity using combined Levenshtein distance ratio & Dice coefficient.
 */
export function stringSimilarity(query: string, target: string): number {
  const q = query.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (q === t) return 1.0;
  if (!q || !t) return 0.0;

  // Substring inclusion bonus
  if (t.includes(q) || q.includes(t)) {
    const ratio = Math.min(q.length, t.length) / Math.max(q.length, t.length);
    return Math.max(0.85, 0.75 + 0.25 * ratio);
  }

  const dice = diceCoefficient(q, t);
  const maxLen = Math.max(q.length, t.length);
  const levDist = levenshteinDistance(q, t);
  const levRatio = Math.max(0, (maxLen - levDist) / maxLen);

  return 0.6 * dice + 0.4 * levRatio;
}

/**
 * Finds the best catalog product match for a spoken grocery query.
 */
export function matchCatalogQuery(
  rawQuery: string | { query: string; quantity?: number; sizeHint?: string },
  quantityHint?: number,
  sizeHintParam?: string,
): CatalogMatchResult {
  const queryStr = typeof rawQuery === 'string' ? rawQuery : (rawQuery?.query ?? '');
  const quantityResolved = typeof rawQuery === 'object' && rawQuery?.quantity !== undefined
    ? rawQuery.quantity
    : (quantityHint ?? 1);
  const sizeHint = typeof rawQuery === 'object' && rawQuery?.sizeHint !== undefined
    ? rawQuery.sizeHint
    : sizeHintParam;

  const query = (queryStr || '').trim();
  if (!query) {
    return {
      query: '',
      quantity: quantityResolved,
      confidence: 'low',
      score: 0,
      isUnresolved: true,
    };
  }

  // Normalize and apply Pakistani phonetic corrections
  const normalized = normalizeTranscript(query).normalized;
  const phonetic = applyPhoneticCorrections(normalized);

  let bestEntry: ProductAliasEntry | null = null;
  let bestScore = 0;
  let bestAliasMatched = '';

  for (const entry of PRODUCT_ALIASES) {
    for (const alias of entry.aliases) {
      const aliasNorm = normalizeTranscript(alias).normalized;
      const aliasPhonetic = applyPhoneticCorrections(aliasNorm);

      // 1. Exact match against query or phonetic query
      if (
        normalized === aliasNorm ||
        phonetic === aliasPhonetic ||
        phonetic === aliasNorm ||
        normalized === aliasPhonetic
      ) {
        if (1.0 > bestScore) {
          bestScore = 1.0;
          bestEntry = entry;
          bestAliasMatched = alias;
          break;
        }
      }

      // 2. Token overlap & fuzzy matching
      const sim1 = stringSimilarity(normalized, aliasNorm);
      const sim2 = stringSimilarity(phonetic, aliasPhonetic);
      const score = Math.max(sim1, sim2);

      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
        bestAliasMatched = alias;
      }
    }
  }

  const quantity = typeof quantityResolved === 'number' && quantityResolved > 0 ? quantityResolved : 1;

  // If score is high enough to confidently match
  if (bestEntry && bestScore >= 0.75) {
    const catalog = allGroceryProducts || freshPicks;
    let targetProductId = bestEntry.productId;

    // Resolve variant / size hint if specified (e.g. "bara wala", "small", "1kg", "500g")
    const lowerQuery = `${query} ${sizeHint ?? ''}`.toLowerCase();
    let needsVariantConfirmation = false;

    if (bestEntry.availableSizes && bestEntry.availableSizes.length > 1) {
      if (
        lowerQuery.includes('bara') ||
        lowerQuery.includes('large') ||
        lowerQuery.includes('family') ||
        lowerQuery.includes('2kg') ||
        lowerQuery.includes('900g')
      ) {
        const large = bestEntry.availableSizes.find(
          s =>
            s.size.toLowerCase().includes('large') ||
            s.size.toLowerCase().includes('bara') ||
            s.size.includes('2kg') ||
            s.size.includes('900g') ||
            s.size.includes('Family'),
        );
        if (large) targetProductId = large.productId;
      } else if (
        lowerQuery.includes('chota') ||
        lowerQuery.includes('small') ||
        lowerQuery.includes('500g') ||
        lowerQuery.includes('400g') ||
        lowerQuery.includes('half')
      ) {
        const small = bestEntry.availableSizes.find(
          s =>
            s.size.toLowerCase().includes('small') ||
            s.size.toLowerCase().includes('chota') ||
            s.size.includes('500g') ||
            s.size.includes('400g') ||
            s.size.includes('Plain'),
        );
        if (small) targetProductId = small.productId;
      } else {
        // Size is ambiguous, ask for confirmation in Review UI
        needsVariantConfirmation = true;
      }
    }

    const product = catalog.find(p => p.id === targetProductId);

    const confidence: MatchConfidence =
      bestScore >= 0.9 ? 'high' : bestScore >= 0.8 ? 'medium' : 'low';

    return {
      productId: targetProductId,
      productName: product?.name ?? bestEntry.canonicalName,
      canonicalName: bestEntry.canonicalName,
      unitPrice: product?.price,
      quantity,
      confidence,
      score: bestScore,
      query,
      rawPhrase: query,
      sizeHint,
      needsVariantConfirmation,
      candidateVariants: bestEntry.availableSizes,
      isUnresolved: false,
    };
  }

  // Not matched confidently: preserve as unresolved fragment
  return {
    query,
    rawPhrase: query,
    quantity,
    confidence: 'low',
    score: bestScore,
    isUnresolved: true,
  };
}

/**
 * Matches a list of interpreted grocery items against the catalog.
 * Handles self-corrections (e.g. "doodh do nahi teen" -> Milk x3).
 */
export function matchCatalogOrder(
  items: readonly {
    query: string;
    quantity?: number;
    unit?: string;
    sizeHint?: string;
    confidence?: number;
  }[],
): CatalogMatchResult[] {
  const matches: CatalogMatchResult[] = [];
  const seenProducts = new Map<string, number>();

  for (const item of items) {
    const result = matchCatalogQuery(item.query, item.quantity, item.sizeHint);

    // If item was matched to a productId, handle duplicate / correction aggregation
    if (result.productId) {
      if (seenProducts.has(result.productId)) {
        const existingIndex = seenProducts.get(result.productId)!;
        // If customer repeated product with a new quantity, the later correction overrides
        matches[existingIndex].quantity = result.quantity;
      } else {
        seenProducts.set(result.productId, matches.length);
        matches.push(result);
      }
    } else {
      matches.push(result);
    }
  }

  return matches;
}
