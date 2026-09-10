import { GroqError, transcribe, completeChat, type ChatTurn } from './groq';

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
  'HashmiMart grocery shopping voice order from a customer in Pakistan.',
  'Urdu, Roman Urdu, Punjabi, Roman Punjabi, English, or a mixture of these languages.',
  'Transcribe the entire recording from beginning to end. Preserve every grocery item, brand name, quantity, unit, size, and variant.',
  'ایک دو تین چار پانچ چھ سات آٹھ نو دس درجن آدھا کلو پاؤ پیکٹ بوتل ڈبہ تھیلا۔',
  'ٹماٹر کیلا پالک سیب کھیرا آلو پیاز دودھ دہی انڈے آٹا چاول چینی چائے پتی نمک سرف کوک پیپسی۔',
  'تیل گھی دال چنا ادرک لہسن مرغی گوشت مچھلی روٹی بریڈ سنترہ مالٹا صابن شیمپو بسکٹ مصالحہ۔',
  'Quantities: aik, ek, ik, do, teen, trai, chaar, paanch, panj, chay, chhe, saat,',
  'aath, nau, das, aadha kilo, paao, pao, dozen, darjan, packet, pack, bottle, dabba, thaila, litre, liter, kg.',
  'Items and brands: doodh, milk, Olpers, olper, milkpak, atta, chawal, cheeni, sugar, ghee, dalda, sufi, daal,',
  'anda, anday, eggs, bread, oil, Surf, Surf Excel, Ariel, Coke, Coca-Cola, Pepsi, 7up, Sprite, biscuits,',
  'shampoo, soap, chai, patti, Tapal, Lipton, namak, Shan masala, National, aloo, pyaz, tamatar, adrak,',
  'lehsan, kela, seb, santra, malta, palak, kheera, gosht, murghi, machli.',
  'Do not summarize. Do not omit repeated items. Do not stop after the first few products.',
].join(' ');

/**
 * The parser's master instructions.
 *
 * Enforces reading the ENTIRE transcript from start to finish, handling customer
 * self-corrections (latest correction wins), preserving late items after pauses
 * or fillers, and extracting every requested item without arbitrary truncation.
 */
const PARSE_SYSTEM = `You are HashmiMart's grocery-order interpretation engine for a grocery delivery application in Pakistan.

The input is a transcript produced from a customer's complete voice recording.

IMPORTANT RULES:
1. READ THE ENTIRE TRANSCRIPT: Read the entire customer transcript from the first word to the final word before producing any result. Never prioritize only the beginning of the transcript. Products may be added, removed, corrected, or clarified at any point, including the final sentence.
2. EXTRACT EVERY REQUESTED ITEM: Scan the complete transcript for all products, brands, quantities, units, sizes, and variants. Never stop extraction after finding the first valid items. Your goal is COMPLETE COVERAGE.
3. CUSTOMER SELF-CORRECTIONS: Customers frequently correct themselves as they think. The latest explicit correction ALWAYS wins.
   - Example: "doodh do... nahi teen kar do" -> Milk quantity 3 (NOT 2, NOT both).
   - Example: "bread do... actually bread aik" -> Bread quantity 1.
   - Example: "Coke do, Pepsi nahi" -> Coke quantity 2, and DO NOT add Pepsi.
4. ITEMS AFTER FILLERS OR PAUSES: Words like "bas", "acha", "phir", "aur haan", "theek hai" or pauses must NEVER make you stop or discard what comes after.
   - Example: "do doodh aur aik bread... bas... acha anday bhi chay kar dena... aur Coke do bottles" -> must extract Milk x2, Bread x1, Eggs x6, Coke x2.
5. LANGUAGE & NORMALIZATION:
   - The speech may be in Urdu (Urdu script or Roman Urdu), Punjabi (Shahmukhi or Roman Punjabi), English, or any mixture.
   - Normalise Pakistani number words: aik/ek/ik/one=1, do/two=2, teen/trai/three=3, chaar/char/four=4, paanch/panj/five=5, chay/chhe/six=6, saat/seven=7, aath/eight=8, nau/nine=9, das/ten=10, darjan/dozen=12, half dozen=6.
   - Units: kilo/kg, aadha kilo=0.5 kg, paao/pao=0.25 kg, litre/liter, packet/pack, bottle, dabba, piece/pcs.
   - "query" is the normalized grocery item or brand name (in English where standard, e.g. "milk", "bread", "eggs", "sugar", "tomato", "banana", "potato", "onion", "Surf Excel", "Coke", "Pepsi", "Tapal tea", "cooking oil").
6. UNRESOLVED / UNCLEAR FRAGMENTS:
   - If something sounds grocery-related but is unclear or unintelligible, do NOT invent or drop it. Place it in "unresolvedFragments" with the exact phrase heard so the customer can clarify.
7. NO HALLUCINATIONS:
   - Do NOT invent prices.
   - Do NOT invent items that were not requested.
   - Do NOT summarize ("customer wants groceries").
8. FINAL COVERAGE SCAN:
   - Before returning, scan the transcript from start to end to verify every grocery phrase is accounted for.

Return ONLY a valid JSON object matching this schema (no markdown fences, no explanatory prose):
{
  "items": [
    {
      "query": "milk",
      "quantity": 2,
      "unit": "packet",
      "brand": "Olpers",
      "confidence": 0.95
    }
  ],
  "unresolvedFragments": [],
  "language": "ur" | "pa" | "en" | "mixed"
}`;

export type ParsedItem = {
  query: string;
  quantity?: number;
  unit?: string;
  brand?: string;
  confidence?: number;
};

/** Transcribes, with the comprehensive grocery bias applied. */
export async function transcribeVoiceOrder(
  key: string,
  audio: Blob,
  filename: string,
): Promise<{ text: string }> {
  const text = await transcribe(key, audio, filename, GROCERY_PROMPT);
  return { text };
}

/**
 * Turns a transcript into items with complete coverage.
 */
export async function parseVoiceOrder(
  key: string,
  transcript: string,
): Promise<{
  items: ParsedItem[];
  unresolvedFragments?: string[];
  language?: string;
}> {
  const turns: ChatTurn[] = [
    { role: 'system', content: PARSE_SYSTEM },
    { role: 'user', content: transcript.slice(0, 6000) },
  ];

  let raw: string;
  try {
    raw = await completeChat(key, turns);
  } catch (error) {
    if (error instanceof GroqError) throw error;
    throw new GroqError('upstream', 'Parse failed');
  }

  // Strip markdown code fences if present.
  const body = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  try {
    const parsed = JSON.parse(body) as {
      items?: unknown;
      unresolvedFragments?: unknown;
      language?: unknown;
    };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const unresolvedFragments = Array.isArray(parsed.unresolvedFragments)
      ? (parsed.unresolvedFragments.filter(f => typeof f === 'string' && f.trim()) as string[])
      : undefined;

    return {
      items: items.flatMap(item => {
        const query = (item as ParsedItem)?.query;
        if (typeof query !== 'string' || !query.trim()) return [];
        const quantity = (item as ParsedItem)?.quantity;
        const confidence = (item as ParsedItem)?.confidence;
        const brand = (item as ParsedItem)?.brand;
        return [
          {
            query: query.trim().slice(0, 80),
            quantity:
              typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0 && quantity <= 99
                ? quantity
                : undefined,
            unit:
              typeof (item as ParsedItem)?.unit === 'string'
                ? (item as ParsedItem).unit
                : undefined,
            brand:
              typeof brand === 'string' && brand.trim()
                ? brand.trim().slice(0, 50)
                : undefined,
            confidence:
              typeof confidence === 'number' && Number.isFinite(confidence)
                ? Math.min(1, Math.max(0, confidence))
                : undefined,
          },
        ];
      }),
      unresolvedFragments,
      language:
        typeof parsed.language === 'string' ? parsed.language : undefined,
    };
  } catch {
    return { items: [] };
  }
}
