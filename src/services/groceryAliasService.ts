/**
 * Grocery Alias & Vocabulary Service for HashmiMart.
 *
 * Provides comprehensive brand aliases, colloquial terms, Pakistani transliterations,
 * and common Whisper phonetic transcription errors.
 */

export type ProductAliasEntry = {
  productId: string;
  canonicalName: string;
  brand?: string;
  category: string;
  aliases: readonly string[];
  searchKeywords: readonly string[];
  defaultSize?: string;
  availableSizes?: readonly { size: string; productId: string }[];
};

export const PRODUCT_ALIASES: readonly ProductAliasEntry[] = [
  {
    productId: 'olpers-milk-1l',
    canonicalName: 'Olpers Milk 1L',
    brand: 'Olpers',
    category: 'Dairy',
    defaultSize: '1L',
    availableSizes: [
      { size: '1L', productId: 'olpers-milk-1l' },
    ],
    aliases: [
      'olpers', 'olper', 'olpers milk', 'olper milk', 'olpers doodh', 'olper doodh',
      'olper dude', 'olpers dude', 'olper dudh', 'olper dud',
      'دودھ اولپرز', 'اولپرز', 'اولپر',
    ],
    searchKeywords: ['olpers', 'milk', 'doodh', 'uht', 'dairy', '1l'],
  },
  {
    productId: 'milkpak-1l',
    canonicalName: 'Nestle Milkpak 1L',
    brand: 'Milkpak',
    category: 'Dairy',
    defaultSize: '1L',
    aliases: [
      'milkpak', 'milk pak', 'nestle milkpak', 'nestle milk pak', 'milkpack', 'nestle milk pack',
      'ملک پیک', 'دودھ ملک پیک',
    ],
    searchKeywords: ['milkpak', 'nestle', 'milk', 'doodh', '1l'],
  },
  // Generic milk aliases fallback to Olpers Milk 1L
  {
    productId: 'olpers-milk-1l',
    canonicalName: 'Milk 1L',
    category: 'Dairy',
    aliases: [
      'milk', 'doodh', 'dudh', 'dude', 'dud', 'dodh', 'dood', 'fresh milk',
      'دودھ', 'دود',
    ],
    searchKeywords: ['milk', 'doodh'],
  },

  // Bread
  {
    productId: 'dawn-bread-plain',
    canonicalName: 'Dawn Bread Plain',
    brand: 'Dawn',
    category: 'Bakery',
    defaultSize: 'Medium',
    availableSizes: [
      { size: 'Plain / Medium', productId: 'dawn-bread-plain' },
      { size: 'Large / Family', productId: 'dawn-bread-large' },
    ],
    aliases: [
      'bread', 'bred', 'brad', 'dawn bread', 'dawn plain bread', 'plain bread',
      'roti', 'double roti', 'dabal roti', 'duble roti', 'double rotee',
      'بریڈ', 'ڈبل روٹی', 'روٹی',
    ],
    searchKeywords: ['bread', 'dawn', 'bakery', 'plain', 'roti'],
  },
  {
    productId: 'dawn-bread-large',
    canonicalName: 'Dawn Bread Large',
    brand: 'Dawn',
    category: 'Bakery',
    defaultSize: 'Large',
    aliases: [
      'dawn bread large', 'large bread', 'family bread', 'bara bread', 'bari bread',
      'bari double roti', 'bara wala bread', 'large dawn bread',
    ],
    searchKeywords: ['bread', 'dawn', 'large', 'family'],
  },

  // Eggs
  {
    productId: 'fresh-eggs-12',
    canonicalName: 'Farm Eggs 1 Dozen',
    category: 'Dairy',
    defaultSize: '1 Dozen',
    availableSizes: [
      { size: '1 Dozen (12 pcs)', productId: 'fresh-eggs-12' },
      { size: 'Half Dozen (6 pcs)', productId: 'fresh-eggs-6' },
    ],
    aliases: [
      'egg', 'eggs', 'anday', 'ande', 'aanday', 'anda', 'farm eggs',
      'dozen eggs', 'darjan anday', 'aik darjan anday', 'desi anday',
      'انڈے', 'انڈا', 'انڈوں',
    ],
    searchKeywords: ['eggs', 'anday', 'dozen', 'farm'],
  },
  {
    productId: 'fresh-eggs-6',
    canonicalName: 'Farm Eggs 6 Pack',
    category: 'Dairy',
    defaultSize: '6 Pack',
    aliases: [
      'chay anday', 'che anday', '6 anday', 'half dozen eggs', 'adha darjan anday',
      '6 eggs', 'six eggs',
    ],
    searchKeywords: ['eggs', '6 pack', 'half dozen'],
  },

  // Surf / Detergent
  {
    productId: 'surf-excel-1kg',
    canonicalName: 'Surf Excel 1kg',
    brand: 'Surf Excel',
    category: 'Household',
    defaultSize: '1kg',
    availableSizes: [
      { size: '500g', productId: 'surf-excel-500g' },
      { size: '1kg', productId: 'surf-excel-1kg' },
      { size: '2kg (Bara Wala)', productId: 'surf-excel-2kg' },
    ],
    aliases: [
      'surf', 'serf', 'surf excel', 'surf exel', 'surface excel', 'surface',
      'detergent', 'washing powder', 'surf excel 1kg', 'ek kilo surf',
      'سرف', 'سرف ایکسل',
    ],
    searchKeywords: ['surf', 'excel', 'detergent', 'washing powder', '1kg'],
  },
  {
    productId: 'surf-excel-500g',
    canonicalName: 'Surf Excel 500g',
    brand: 'Surf Excel',
    category: 'Household',
    defaultSize: '500g',
    aliases: [
      'surf excel 500g', 'chota surf', 'chota wala surf', 'aadha kilo surf',
      'surf 500g',
    ],
    searchKeywords: ['surf', 'excel', '500g', 'small'],
  },
  {
    productId: 'surf-excel-2kg',
    canonicalName: 'Surf Excel 2kg',
    brand: 'Surf Excel',
    category: 'Household',
    defaultSize: '2kg',
    aliases: [
      'surf excel 2kg', 'bara wala surf', 'bari wali surf', 'bara surf',
      'surf excel bara wala', 'surface excel bara wala', 'serf bara wala',
      '2kg surf', 'do kilo surf',
    ],
    searchKeywords: ['surf', 'excel', '2kg', 'large', 'bara wala'],
  },

  // Cold Drinks (Coke / Pepsi)
  {
    productId: 'coca-cola-1-5l',
    canonicalName: 'Coca-Cola 1.5L',
    brand: 'Coca-Cola',
    category: 'Beverages',
    defaultSize: '1.5L',
    availableSizes: [
      { size: '500ml', productId: 'coca-cola-500ml' },
      { size: '1.5L', productId: 'coca-cola-1-5l' },
    ],
    aliases: [
      'coke', 'kok', 'cok', 'coca', 'coca cola', 'coca-cola', 'cold drink coke',
      'coke 1.5', 'coke 1.5l', 'coke bara wala', 'bari coke', 'cold drink',
      'کوک', 'کوکا کولا',
    ],
    searchKeywords: ['coke', 'coca cola', 'beverages', 'cold drink', '1.5l'],
  },
  {
    productId: 'coca-cola-500ml',
    canonicalName: 'Coca-Cola 500ml',
    brand: 'Coca-Cola',
    category: 'Beverages',
    defaultSize: '500ml',
    aliases: ['coke 500ml', 'choti coke', 'small coke', 'coke half litre'],
    searchKeywords: ['coke', '500ml'],
  },
  {
    productId: 'pepsi-1-5l',
    canonicalName: 'Pepsi 1.5L',
    brand: 'Pepsi',
    category: 'Beverages',
    defaultSize: '1.5L',
    aliases: ['pepsi', 'pepsi 1.5', 'pepsi cola', 'pepsee', 'pepsi botal', 'pepsee botal', 'پپسی'],
    searchKeywords: ['pepsi', 'cold drink', '1.5l'],
  },

  // Sugar
  {
    productId: 'sugar-1kg',
    canonicalName: 'White Sugar 1kg',
    category: 'Pantry',
    defaultSize: '1kg',
    aliases: [
      'sugar', 'shugar', 'cheeni', 'chini', 'chinni', 'white sugar', 'kilo sugar',
      'چینی', 'شکر',
    ],
    searchKeywords: ['sugar', 'cheeni', '1kg'],
  },

  // Atta / Flour
  {
    productId: 'atta-5kg',
    canonicalName: 'Sunridge Chakki Atta 5kg',
    brand: 'Sunridge',
    category: 'Pantry',
    defaultSize: '5kg',
    availableSizes: [
      { size: '5kg', productId: 'atta-5kg' },
      { size: '10kg', productId: 'atta-10kg' },
    ],
    aliases: [
      'atta', 'aata', 'ata', 'flour', 'chakki atta', 'sunridge atta', 'sunridge',
      'panch kilo atta', '5kg atta', 'آٹا', 'چکی آٹا',
    ],
    searchKeywords: ['atta', 'flour', 'sunridge', 'chakki', '5kg'],
  },
  {
    productId: 'atta-10kg',
    canonicalName: 'Sunridge Chakki Atta 10kg',
    brand: 'Sunridge',
    category: 'Pantry',
    defaultSize: '10kg',
    aliases: [
      'atta 10kg', '10 kilo atta', 'das kilo atta', 'bara atta thaila', 'atta thaila',
    ],
    searchKeywords: ['atta', 'flour', '10kg'],
  },

  // Rice
  {
    productId: 'rice-1kg',
    canonicalName: 'Guard Basmati Rice 1kg',
    brand: 'Guard',
    category: 'Pantry',
    defaultSize: '1kg',
    aliases: [
      'rice', 'chawal', 'chaval', 'chawel', 'basmati rice', 'guard rice', 'guard chawal',
      'چاول', 'باسمتی چاول',
    ],
    searchKeywords: ['rice', 'chawal', 'basmati', '1kg'],
  },

  // Tea
  {
    productId: 'tapal-danedar-400g',
    canonicalName: 'Tapal Danedar Tea 400g',
    brand: 'Tapal',
    category: 'Beverages',
    defaultSize: '400g',
    availableSizes: [
      { size: '400g', productId: 'tapal-danedar-400g' },
      { size: '900g (Bara Wala)', productId: 'tapal-danedar-900g' },
    ],
    aliases: [
      'tapal', 'danedar', 'tapal danedar', 'tapal tea', 'chai patti', 'patti', 'chai',
      'tapal danedar 400g', 'ٹپال', 'دانے دار', 'چائے', 'پتی',
    ],
    searchKeywords: ['tea', 'tapal', 'danedar', 'chai', 'patti', '400g'],
  },
  {
    productId: 'tapal-danedar-900g',
    canonicalName: 'Tapal Danedar Tea 900g',
    brand: 'Tapal',
    category: 'Beverages',
    defaultSize: '900g',
    aliases: [
      'tapal danedar bara wala', 'tapal bara wala', 'danedar bara wala', 'tapal 900g',
      'bari tapal',
    ],
    searchKeywords: ['tea', 'tapal', 'danedar', '900g', 'large'],
  },

  // Salt
  {
    productId: 'salt-800g',
    canonicalName: 'National Iodized Salt 800g',
    brand: 'National',
    category: 'Pantry',
    defaultSize: '800g',
    aliases: [
      'salt', 'namak', 'national salt', 'iodized salt', 'national namak',
      'نمک', 'نیشنل نمک',
    ],
    searchKeywords: ['salt', 'namak', 'national', '800g'],
  },

  // Cooking Oil
  {
    productId: 'dalda-oil-1l',
    canonicalName: 'Dalda Cooking Oil 1L',
    brand: 'Dalda',
    category: 'Pantry',
    defaultSize: '1L',
    availableSizes: [
      { size: '1L', productId: 'dalda-oil-1l' },
      { size: '5L Can', productId: 'dalda-oil-5l' },
    ],
    aliases: [
      'oil', 'cooking oil', 'dalda', 'dalda oil', 'dalda cooking oil', 'tel',
      'ghee', 'gheo', 'banaspati', 'تیل', 'ڈالڈا', 'گھی',
    ],
    searchKeywords: ['oil', 'cooking oil', 'dalda', 'tel', 'ghee', '1l'],
  },
  {
    productId: 'dalda-oil-5l',
    canonicalName: 'Dalda Cooking Oil 5L',
    brand: 'Dalda',
    category: 'Pantry',
    defaultSize: '5L',
    aliases: [
      'dalda 5l', 'oil 5l', 'dalda can', 'dalda bara', '5 kilo oil', 'panch litre oil',
    ],
    searchKeywords: ['oil', 'dalda', '5l'],
  },

  // Produce
  {
    productId: 'tomato',
    canonicalName: 'Tomato Organic',
    category: 'Fresh Produce',
    aliases: [
      'tomato', 'tomatoes', 'tamatar', 'tamater', 'tamatr', 'tamaatar', 'timatar',
      'ٹماٹر', 'تماتر',
    ],
    searchKeywords: ['tomato', 'produce', 'tamatar'],
  },
  {
    productId: 'banana',
    canonicalName: 'Banana Premium',
    category: 'Fresh Produce',
    aliases: [
      'banana', 'bananas', 'kela', 'kele', 'kaila', 'kaile', 'keela',
      'کیلا', 'کیلے', 'کیلہ',
    ],
    searchKeywords: ['banana', 'kela', 'produce'],
  },
  {
    productId: 'spinach',
    canonicalName: 'Spinach Fresh',
    category: 'Fresh Produce',
    aliases: [
      'spinach', 'greens', 'palak', 'paalak', 'saag', 'sag',
      'پالک', 'ساگ',
    ],
    searchKeywords: ['spinach', 'palak', 'produce'],
  },
  {
    productId: 'apple',
    canonicalName: 'Apple Red',
    category: 'Fresh Produce',
    aliases: [
      'apple', 'apples', 'seb', 'saib', 'sev', 'seo',
      'سیب', 'سیو',
    ],
    searchKeywords: ['apple', 'seb', 'produce'],
  },
  {
    productId: 'cucumber',
    canonicalName: 'Cucumber',
    category: 'Fresh Produce',
    aliases: [
      'cucumber', 'cucumbers', 'kheera', 'khira', 'kheere', 'khera', 'kakri', 'kakdi',
      'کھیرا', 'کھیرے', 'ککڑی',
    ],
    searchKeywords: ['cucumber', 'kheera', 'produce'],
  },
  {
    productId: 'potato-1kg',
    canonicalName: 'Potato Fresh 1kg',
    category: 'Fresh Produce',
    aliases: ['potato', 'potatoes', 'aloo', 'alu', 'aalu', 'آلو'],
    searchKeywords: ['potato', 'aloo', 'produce'],
  },
  {
    productId: 'onion-1kg',
    canonicalName: 'Onion Fresh 1kg',
    category: 'Fresh Produce',
    aliases: ['onion', 'onions', 'pyaz', 'piyaz', 'pyaaz', 'pyaj', 'پیاز'],
    searchKeywords: ['onion', 'pyaz', 'produce'],
  },
];

/**
 * Common phonetic / transcription error replacements for Roman Urdu / Punjabi grocery speech.
 */
export const PHONETIC_CORRECTIONS: [RegExp, string][] = [
  // Milk
  [/\b(dude|dud|dodh|dood)\b/gi, 'doodh'],
  [/\b(olper)\b/gi, 'olpers'],
  [/\b(milk pack|milk pak|milkpack)\b/gi, 'milkpak'],
  // Detergent / Surf
  [/\b(serf|surface excel|surface exel|surf exel)\b/gi, 'surf excel'],
  [/\b(surface)\b/gi, 'surf'],
  // Cold drinks
  [/\b(kok|cok|coka|coka cola)\b/gi, 'coke'],
  [/\b(pepsee|pepsico)\b/gi, 'pepsi'],
  // Bread
  [/\b(bred|brad)\b/gi, 'bread'],
  // Eggs
  [/\b(ande|aanday|andaa)\b/gi, 'anday'],
  // Sugar
  [/\b(shugar|chini|chinni)\b/gi, 'cheeni'],
  // Atta
  [/\b(aata|ata)\b/gi, 'atta'],
  // Rice
  [/\b(chaval|chawel)\b/gi, 'chawal'],
  // Tea
  [/\b(chaye|chae)\b/gi, 'chai'],
];

/**
 * Applies phonetic corrections to a normalized query string.
 */
export function applyPhoneticCorrections(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PHONETIC_CORRECTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Resolves a grocery phrase or product name to its canonical alias entry.
 */
export function resolveGroceryAlias(rawText: string): {
  productId: string;
  canonicalProduct: string;
  brand?: string;
  defaultSize?: string;
} | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const norm = applyPhoneticCorrections(
    rawText.toLowerCase().replace(/['’]/g, '').trim(),
  );

  let bestMatch: {
    productId: string;
    canonicalProduct: string;
    brand?: string;
    defaultSize?: string;
    aliasLength: number;
  } | null = null;

  for (const entry of PRODUCT_ALIASES) {
    for (const alias of entry.aliases) {
      const aliasNorm = alias.toLowerCase().trim();
      const escaped = aliasNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');

      if (norm === aliasNorm || regex.test(norm)) {
        if (!bestMatch || aliasNorm.length > bestMatch.aliasLength) {
          bestMatch = {
            productId: entry.productId,
            canonicalProduct: entry.brand || entry.canonicalName,
            brand: entry.brand,
            defaultSize: entry.defaultSize,
            aliasLength: aliasNorm.length,
          };
        }
      }
    }
  }
  return bestMatch;
}

/**
 * Returns all phonetic and linguistic aliases registered for a product ID.
 */
export function getPhoneticAliases(productId: string): string[] {
  const entry = PRODUCT_ALIASES.find(p => p.productId === productId);
  return entry ? [...entry.aliases] : [];
}

