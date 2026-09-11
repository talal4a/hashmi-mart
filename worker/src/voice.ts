import {
  GroqError,
  transcribe,
  completeChat,
  TRANSCRIBE_ACCURATE,
  TRANSCRIBE_FAST,
  type ChatTurn,
} from './groq';

/**
 * Voice Order's two AI steps, kept apart on purpose.
 *
 * Whisper is the ears and the model after it is the brain. Transcription only
 * has to produce something readable; turning "do kilo aloo aur aik darjan anday"
 * into quantities and product names is a different job with a different failure
 * mode, and folding them into one call means a parsing mistake looks like a
 * mishearing. Split, the app can show the user what was heard even when the
 * parse comes back empty — which is what lets a bad parse fall back to sending
 * the original recording rather than to starting over.
 */

/**
 * What Whisper is told to expect.
 *
 * A domain prompt is not a filter; it biases the decode towards words that are
 * plausible here. Pakistani grocery speech is the hard case — Urdu and Punjabi
 * quantity words, English brand names, and all of them in one sentence — and
 * without this, "paao" comes back as "power" and "anday" as "and A".
 *
 * Deliberately no language pin. Users mix Urdu, Punjabi and English inside a
 * single order, and forcing one turns the other two into transliterated noise.
 */
const GROCERY_PROMPT = [
  'HashmiMart grocery order in Urdu, Roman Urdu, Punjabi or English.',
  // Urdu script first: this is what a genuinely Urdu order comes back as, and
  // biasing towards the right spellings of these words is most of the accuracy
  // on the language that was failing.
  'ایک دو تین چار پانچ چھ سات آٹھ نو دس درجن آدھا کلو پاؤ پیکٹ بوتل ڈبہ تھیلا۔',
  'ٹماٹر کیلا پالک سیب کھیرا آلو پیاز دودھ دہی انڈے آٹا چاول چینی چائے پتی نمک',
  'تیل گھی دال چنا ادرک لہسن مرغی گوشت مچھلی روٹی بریڈ سنترہ مالٹا۔',
  'Quantities: aik, ek, ik, do, teen, trai, chaar, paanch, panj, chay, saat,',
  'aath, nau, das, aadha kilo, paao, dozen, darjan, packet, bottle, dabba, thaila.',
  'Items: doodh, dahi, anday, aata, chawal, cheeni, chai, patti, namak, tel,',
  'ghee, dal, chana, aloo, pyaz, tamatar, adrak, lehsan, kela, seb, santra,',
  'malta, palak, saag, kheera, kakri, gosht, murghi, machli, bread, biscuit.',
].join(' ');

/**
 * The parser's rules.
 *
 * The hard one is the last: it may not invent a product. A model asked to
 * normalise a shopping list will happily produce something plausible for a word
 * it did not understand, and a plausible wrong item is worse than a missing one
 * — the customer confirms a list that looks right and receives something else.
 * Anything unclear comes back with low confidence and the original words
 * attached, so the app can ask about that item alone.
 */
const PARSE_SYSTEM = `You convert a spoken Pakistani grocery order into structured items.

The speech may be Urdu, Roman Urdu, Punjabi, English, or a mix. Normalise
quantity words: aik/ek=1, do=2, teen=3, chaar=4, paanch=5, chay=6, saat=7,
aath=8, nau=9, das=10, aadha kilo=0.5 kg, paao/pao=0.25 kg, darjan/dozen=12.

Return ONLY a JSON object, no prose, no code fence:

{"items":[{"query":"...","quantity":1,"unit":"kg"|"g"|"litre"|"ml"|"unit"|"packet","confidence":0.0-1.0}],"language":"ur"|"pa"|"en"|"mixed"}

Rules:
- "query" is the item as the speaker meant it. Give plain English where the word
  is a common grocery item (ٹماٹر/tamatar -> tomato, کیلا/kela -> banana,
  پالک/palak -> spinach, کھیرا/kheera -> cucumber, سیب/seb -> apple,
  دودھ/doodh -> milk, انڈے/anday -> eggs, آلو/aloo -> potato). This holds for
  Urdu script exactly as it does for Roman: translate the word, do not transcribe
  it back. If you do not recognise the word, return it exactly as spoken —
  including in Urdu script — rather than guessing at an English one.
- NEVER invent an item that was not spoken. If a word is unclear, still return
  it with the words you heard and a confidence below 0.5.
- Omit quantity rather than guessing it. An absent quantity is recoverable; a
  wrong one is not.
- If nothing orderable was said, return {"items":[],"language":"..."}.`;

export type ParsedItem = {
  query: string;
  quantity?: number;
  unit?: string;
  confidence?: number;
};

/**
 * Words that mean the decode produced nothing worth reading.
 *
 * Whisper does not return an error for a recording it could not make sense of;
 * it returns its best guess, and its best guess at background noise is a
 * pleasantry. These are the ones it reaches for, and treating them as a
 * transcript is how "we heard: Thank you." ends up on a grocery screen.
 */
const NOISE = new Set([
  'thank you.',
  'thank you',
  'thanks for watching!',
  'thanks for watching',
  'you',
  '.',
  'bye.',
  'bye',
  'شکریہ',
]);

/** Too short to be an order, however fast the customer was talking. */
const MIN_USEFUL_CHARS = 3;

function looksUnusable(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < MIN_USEFUL_CHARS) return true;
  return NOISE.has(trimmed.toLowerCase());
}

/**
 * Transcribes, fast first and accurately only if that was not enough.
 *
 * Turbo answers in a fraction of the time and gets ordinary grocery speech
 * right, which is what most orders are. The second pass exists for the ones it
 * returns nothing usable for — a very short, very fast order, or one spoken
 * over a shop's background noise — and it runs only then. Always calling both
 * would double the wait on every order and spend two requests of a small free
 * quota to improve the few Turbo missed.
 *
 * A rate limit on the fast model is not a reason to try the slow one: the limit
 * is on the account, not the model, and a second request is one more rejection.
 */
export async function transcribeVoiceOrder(
  key: string,
  audio: Blob,
  filename: string,
): Promise<{ text: string; model: string }> {
  let fast = '';
  try {
    fast = await transcribe(key, audio, filename, GROCERY_PROMPT, TRANSCRIBE_FAST);
  } catch (error) {
    if (error instanceof GroqError && error.code === 'rate-limited') throw error;
    // Anything else is worth one more try on the other model.
  }

  if (fast && !looksUnusable(fast)) return { text: fast, model: TRANSCRIBE_FAST };

  const accurate = await transcribe(
    key,
    audio,
    filename,
    GROCERY_PROMPT,
    TRANSCRIBE_ACCURATE,
  );
  // Still nothing usable: hand back the empty string rather than the
  // pleasantry. The app treats empty as silence and asks for the order again,
  // which is the right thing to do with a recording nobody could read.
  if (looksUnusable(accurate)) return { text: '', model: TRANSCRIBE_ACCURATE };
  return { text: accurate, model: TRANSCRIBE_ACCURATE };
}

/**
 * Turns a transcript into items, or into nothing.
 *
 * A model that will not produce valid JSON is a model whose answer cannot be
 * trusted with an order, so a parse failure returns an empty list rather than a
 * salvage attempt. Empty is a state the app already handles — it offers to send
 * the original recording — and that is a better outcome than a half-read list
 * the customer has to audit.
 */
export async function parseVoiceOrder(
  key: string,
  transcript: string,
): Promise<{ items: ParsedItem[]; language?: string }> {
  const turns: ChatTurn[] = [
    { role: 'system', content: PARSE_SYSTEM },
    { role: 'user', content: transcript.slice(0, 2000) },
  ];

  let raw: string;
  try {
    raw = await completeChat(key, turns);
  } catch (error) {
    if (error instanceof GroqError) throw error;
    throw new GroqError('upstream', 'Parse failed');
  }

  // Models add fences even when told not to; stripping one is cheaper than
  // failing an otherwise good answer.
  const body = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  try {
    const parsed = JSON.parse(body) as {
      items?: unknown;
      language?: unknown;
    };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      items: items.flatMap(item => {
        const query = (item as ParsedItem)?.query;
        if (typeof query !== 'string' || !query.trim()) return [];
        const quantity = (item as ParsedItem)?.quantity;
        const confidence = (item as ParsedItem)?.confidence;
        return [
          {
            query: query.trim().slice(0, 80),
            quantity:
              typeof quantity === 'number' && quantity > 0 && quantity <= 99
                ? quantity
                : undefined,
            unit:
              typeof (item as ParsedItem)?.unit === 'string'
                ? (item as ParsedItem).unit
                : undefined,
            confidence:
              typeof confidence === 'number' ? Math.min(1, Math.max(0, confidence)) : undefined,
          },
        ];
      }),
      language:
        typeof parsed.language === 'string' ? parsed.language : undefined,
    };
  } catch {
    // Not salvageable, and not worth guessing at: the app falls back to sending
    // the recording, which is the safety layer this whole design rests on.
    return { items: [] };
  }
}
