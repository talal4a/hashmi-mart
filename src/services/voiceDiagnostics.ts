import type { CatalogMatch } from './voiceCatalog';

/**
 * What happened to one voice order, printed where a developer can copy it.
 *
 * The failures this feature has are the kind nobody can describe from the
 * outside. "It missed the last item" and "it didn't understand me" are the same
 * sentence whether Whisper returned nothing, returned Devanagari we could not
 * read, heard every word and lost a quantity, or never ran at all — and the one
 * thing that tells them apart is the transcript, which the screen has no reason
 * to show once an order has gone through.
 *
 * So it goes to the console in one block, ready to paste. Every line here is
 * something that changes what the fix would be.
 *
 * Development only. It never runs in a release build, and there is nothing in
 * it but the customer's own words and our reading of them — no keys, no ids, no
 * audio.
 */

export type VoiceReport = {
  attempt: number;
  durationMs: number;
  bytes: number;
  transcript: string;
  /** Whether the local read was enough, or the model was asked. */
  usedModel: boolean;
  matches: readonly CatalogMatch[];
  unresolved: readonly string[];
  outcome: string;
};

export function reportVoiceOrder(report: VoiceReport): void {
  if (!__DEV__) return;

  const lines = [
    '',
    '──────── VOICE ORDER ────────',
    `attempt      ${report.attempt}`,
    `recording    ${(report.durationMs / 1000).toFixed(1)}s · ${report.bytes} bytes`,
    `transcript   ${report.transcript || '(nothing)'}`,
    `model asked  ${report.usedModel ? 'yes' : 'no (local read was enough)'}`,
    'items',
    ...(report.matches.length
      ? report.matches.map(
          match =>
            `  ${match.productName ?? match.unstocked ?? match.query} ×${match.quantity}` +
            `  ${match.productId ? match.confidence : match.unstocked ? 'not stocked' : 'no match'}`,
        )
      : ['  (none)']),
    `unresolved   ${report.unresolved.length ? report.unresolved.join(' | ') : '(none)'}`,
    `outcome      ${report.outcome}`,
    '─────────────────────────────',
    '',
  ];

  // One call, so it copies out of Metro as a block rather than as twelve
  // interleaved lines with a timestamp on each.
  console.log(lines.join('\n'));
}
