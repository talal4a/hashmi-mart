/**
 * Coverage Validator Service for HashmiMart Voice Orders.
 *
 * Verifies that all grocery-related phrases in the transcript are represented
 * in the final matched order. If an item at the end of a rapid sentence was
 * omitted, it performs exactly ONE repair pass to recover it.
 */

import { matchCatalogQuery, type CatalogMatchResult } from './catalogMatchingService';
import { normalizeTranscript } from './voiceNormalizationService';
import { PRODUCT_ALIASES } from './groceryAliasService';

/** Known grocery keywords that strongly indicate an orderable item */
const GROCERY_ANCHORS = new Set<string>([
  'doodh', 'milk', 'dude', 'dud', 'olpers', 'milkpak',
  'bread', 'bred', 'roti',
  'anday', 'ande', 'egg', 'eggs', 'anda',
  'surf', 'serf', 'surface', 'detergent',
  'coke', 'kok', 'cok', 'coca', 'pepsi', 'drink',
  'sugar', 'cheeni', 'chini', 'shugar',
  'atta', 'aata', 'ata', 'flour',
  'rice', 'chawal', 'chaval',
  'tea', 'chai', 'patti', 'tapal', 'danedar',
  'salt', 'namak',
  'oil', 'tel', 'ghee', 'dalda',
  'tamatar', 'tomato', 'kela', 'banana', 'seb', 'apple',
  'kheera', 'cucumber', 'palak', 'spinach', 'aloo', 'potato', 'pyaz', 'onion',
]);

/**
 * Checks if all grocery anchors in the transcript are covered by existing matches.
 */
export function checkTranscriptCoverage(
  transcript: string,
  matches: readonly CatalogMatchResult[],
): { isCovered: boolean; uncoveredAnchors: string[] } {
  if (!transcript || !matches.length) {
    return { isCovered: false, uncoveredAnchors: [] };
  }

  const { normalized } = normalizeTranscript(transcript);
  const words = normalized.split(/\s+/);

  // Collect text from all existing matches
  const coveredText = matches
    .map(m => `${m.query} ${m.productName ?? ''} ${m.canonicalName ?? ''}`.toLowerCase())
    .join(' ');

  const uncoveredAnchors: string[] = [];

  for (const word of words) {
    if (GROCERY_ANCHORS.has(word)) {
      // Check if this anchor exists in covered text
      if (!coveredText.includes(word)) {
        // Also check against all aliases of matched products
        const isCoveredByAlias = matches.some(m => {
          const entry = PRODUCT_ALIASES.find(p => p.productId === m.productId);
          return entry?.aliases.some(a => a.toLowerCase().includes(word));
        });

        if (!isCoveredByAlias && !uncoveredAnchors.includes(word)) {
          uncoveredAnchors.push(word);
        }
      }
    }
  }

  return {
    isCovered: uncoveredAnchors.length === 0,
    uncoveredAnchors,
  };
}

/**
 * Extracts and matches missed grocery phrases in a single repair pass.
 */
export function repairMissedCoverage(
  transcript: string,
  existingMatches: CatalogMatchResult[],
): CatalogMatchResult[] {
  const coverage = checkTranscriptCoverage(transcript, existingMatches);
  if (coverage.isCovered || coverage.uncoveredAnchors.length === 0) {
    return existingMatches;
  }

  const repaired = [...existingMatches];
  const { normalized } = normalizeTranscript(transcript);
  const tokens = normalized.split(/\s+/);

  for (const anchor of coverage.uncoveredAnchors) {
    const anchorIndex = tokens.indexOf(anchor);
    if (anchorIndex === -1) continue;

    // Grab surrounding context (e.g. "coke do", "surf aik", "sugar kilo one")
    const start = Math.max(0, anchorIndex - 2);
    const end = Math.min(tokens.length, anchorIndex + 3);
    const phrase = tokens.slice(start, end).join(' ');

    // Extract quantity from context if present
    let qty = 1;
    const numMatch = phrase.match(/\b([1-9]|10)\b/);
    if (numMatch) {
      qty = parseInt(numMatch[1], 10);
    }

    const match = matchCatalogQuery(anchor, qty);
    if (match.productId && !repaired.some(m => m.productId === match.productId)) {
      repaired.push(match);
    } else if (!repaired.some(m => m.query.includes(anchor))) {
      repaired.push({
        query: anchor,
        rawPhrase: phrase,
        quantity: qty,
        confidence: 'low',
        score: 0.5,
        isUnresolved: true,
      });
    }
  }

  return repaired;
}
