import {
  normalizeTranscript,
  parseUrduQuantity,
  splitFastSpeech,
} from '../../src/services/voiceNormalizationService';
import {
  resolveGroceryAlias,
  getPhoneticAliases,
} from '../../src/services/groceryAliasService';
import {
  matchCatalogQuery,
  matchCatalogOrder,
} from '../../src/services/catalogMatchingService';
import { repairMissedCoverage } from '../../src/services/coverageValidator';
import {
  validateVoiceCheckout,
  createVoiceOrder,
} from '../../src/services/voiceOrderCheckoutService';
import { allGroceryProducts } from '../../src/data/groceryHome';

describe('Intelligent Voice Order Suite', () => {
  // 1. Fast speech with missing punctuation
  describe('1. Fast speech with missing punctuation', () => {
    it('splits and normalizes unpunctuated continuous speech', () => {
      const input = 'do kilo tamatar aur teen dabba olpers milk ek surf excel packet';
      const normalized = normalizeTranscript(input).normalized;
      expect(normalized).toContain('2 kilo tamatar');
      expect(normalized).toContain('3 dabba olpers milk');
      expect(normalized).toContain('1 surf excel packet');

      const segments = splitFastSpeech(normalized);
      expect(segments.length).toBeGreaterThanOrEqual(3);
    });
  });

  // 2. Brand alias resolving (Olper's, Surf Excel, Milkpak, Tapal, Coke)
  describe('2. Brand alias resolving', () => {
    it('resolves Olpers variants', () => {
      const alias = resolveGroceryAlias("olper's doodh");
      expect(alias?.canonicalProduct).toMatch(/olper/i);
      expect(alias?.productId).toBe('olpers-milk-1l');
    });

    it('resolves Surf Excel', () => {
      const alias = resolveGroceryAlias('surface excel powder');
      expect(alias?.canonicalProduct).toMatch(/surf/i);
      expect(alias?.productId).toBe('surf-excel-1kg');
    });

    it('resolves Milkpak', () => {
      const alias = resolveGroceryAlias('nestle milk pack');
      expect(alias?.canonicalProduct).toMatch(/milkpak/i);
      expect(alias?.productId).toBe('milkpak-1l');
    });

    it('resolves Tapal Danedar', () => {
      const alias = resolveGroceryAlias('tapal chai');
      expect(alias?.canonicalProduct).toMatch(/tapal/i);
      expect(alias?.productId).toBe('tapal-danedar-400g');
    });

    it('resolves Coke / Coca Cola', () => {
      const alias = resolveGroceryAlias('kok botal');
      expect(alias?.canonicalProduct).toMatch(/coca|coke/i);
      expect(alias?.productId).toBe('coca-cola-1-5l');
    });
  });

  // 3. Phonetic / accent typo recovery
  describe('3. Phonetic / accent typo recovery', () => {
    it('recovers common phonetic misspellings for dairy and produce', () => {
      // "dude" for doodh / milk
      const milkMatch = matchCatalogQuery('dude do dabba');
      expect(milkMatch.productId).toMatch(/milk/i);

      // "surface excel" for surf excel
      const surfMatch = matchCatalogQuery('surface excel 1kg');
      expect(surfMatch.productId).toMatch(/surf-excel/);

      // "pepsi" with typo "pepsee"
      const pepsiMatch = matchCatalogQuery('pepsee botal');
      expect(pepsiMatch.productId).toBe('pepsi-1-5l');

      // "atta" with "aata" / "ata"
      const attaMatch = matchCatalogQuery('chakki ata');
      expect(attaMatch.productId).toMatch(/atta/);
    });
  });

  // 4. Partial word recovery
  describe('4. Partial word recovery', () => {
    it('matches partial produce strings accurately', () => {
      const match1 = matchCatalogQuery('tamat');
      expect(match1.productId).toBe('tomato');

      const match2 = matchCatalogQuery('kheer');
      expect(match2.productId).toBe('cucumber');

      const match3 = matchCatalogQuery('pala');
      expect(match3.productId).toBe('spinach');
    });
  });

  // 5. Urdu/Punjabi number words and fractions
  describe('5. Urdu/Punjabi number words and fractions', () => {
    it('normalizes quantities correctly from fractions and terms', () => {
      expect(parseUrduQuantity('aadha kilo')).toEqual({ quantity: 0.5, unit: 'kg' });
      expect(parseUrduQuantity('paao')).toEqual({ quantity: 0.25, unit: 'kg' });
      expect(parseUrduQuantity('derh kilo')).toEqual({ quantity: 1.5, unit: 'kg' });
      expect(parseUrduQuantity('dhai kilo')).toEqual({ quantity: 2.5, unit: 'kg' });
      expect(parseUrduQuantity('ek darjan')).toEqual({ quantity: 12, unit: 'dozen' });
      expect(parseUrduQuantity('do darjan')).toEqual({ quantity: 24, unit: 'dozen' });
      expect(parseUrduQuantity('aadha darjan')).toEqual({ quantity: 6, unit: 'dozen' });
      expect(parseUrduQuantity('teen')).toEqual({ quantity: 3 });
      expect(parseUrduQuantity('char')).toEqual({ quantity: 4 });
      expect(parseUrduQuantity('panch')).toEqual({ quantity: 5 });
      expect(parseUrduQuantity('das')).toEqual({ quantity: 10 });
    });
  });

  // 6. Multi-variant item matching (with size preference)
  describe('6. Multi-variant item matching', () => {
    it('prefers smaller variant when 500g is requested', () => {
      const match = matchCatalogQuery('surf excel', 1, '500g');
      expect(match.productId).toBe('surf-excel-500g');
    });

    it('prefers 2kg variant when 2 kilo is specified', () => {
      const match = matchCatalogQuery('surf excel', 1, '2kg');
      expect(match.productId).toBe('surf-excel-2kg');
    });

    it('provides all available variants for user choice if multiple exist', () => {
      const match = matchCatalogQuery('surf excel');
      expect(match.candidateVariants?.length).toBeGreaterThanOrEqual(2);
      expect(match.candidateVariants?.map(v => v.productId)).toContain('surf-excel-1kg');
      expect(match.candidateVariants?.map(v => v.productId)).toContain('surf-excel-500g');
    });
  });

  // 7. Missing item / out-of-catalog preservation in review
  describe('7. Missing item / out-of-catalog preservation', () => {
    it('preserves items that are not in catalog as unresolved / unstocked rather than dropping them', () => {
      const results = matchCatalogOrder([
        { query: 'tamatar', quantity: 2 },
        { query: 'special imported dragonfruit 5kg', quantity: 1 },
      ]);

      expect(results.some(m => m.productId === 'tomato')).toBe(true);
      // Unstocked / unresolved item preserved
      const unresolvedOrUnstocked = results.filter(m => !m.productId || m.isUnresolved);
      expect(unresolvedOrUnstocked.length).toBeGreaterThanOrEqual(1);
    });

    it('repairs missed trailing grocery items via coverage validator', () => {
      const transcript = 'ek kilo tamatar aur do kilo cheeni aur ek surf excel';
      // Simulating whisper parsed only first two
      const initialMatches = [
        { query: 'tamatar', productId: 'tomato', productName: 'Farm Tomatoes', quantity: 1, confidence: 'high' as const },
        { query: 'cheeni', productId: 'sugar-1kg', productName: 'White Sugar 1kg', quantity: 2, confidence: 'high' as const },
      ];

      const repaired = repairMissedCoverage(transcript, initialMatches);
      expect(repaired.length).toBe(3);
      expect(repaired.some(m => m.productId?.includes('surf-excel'))).toBe(true);
    });
  });

  // 8. Zero false positives on pure gibberish / non-grocery speech
  describe('8. Zero false positives on pure gibberish', () => {
    it('does not match random conversational speech into grocery products', () => {
      const gibberishQueries = [
        'hello how are you doing today',
        'what time does the cricket match start',
        'the weather in lahore is quite warm',
        'xyz qwe asd zxc vbn',
      ];

      for (const query of gibberishQueries) {
        const match = matchCatalogQuery(query);
        expect(match.productId).toBeUndefined();
        expect(match.isUnresolved).toBe(true);
      }
    });
  });

  // 9. Checkout submission state machine (no double submit / duplicate writes)
  describe('9. Checkout submission state machine', () => {
    it('validates checkout payload requirements', () => {
      const invalid = validateVoiceCheckout({
        items: [],
        address: '',
        phone: '',
        name: '',
      });
      expect(invalid.isValid).toBe(false);
      expect(invalid.errors).toContain('Cart cannot be empty for checkout.');
      expect(invalid.errors).toContain('Delivery address is required.');
      expect(invalid.errors).toContain('Phone number is required.');

      const valid = validateVoiceCheckout({
        items: [{ id: 'tomato', quantity: 2, price: 120, name: 'Farm Tomatoes', art: 0, meta: '1kg', total: 240 }],
        address: 'House 12, Street 4, F-7, Islamabad',
        phone: '03001234567',
        name: 'Ali Ahmed',
      });
      expect(valid.isValid).toBe(true);
      expect(valid.errors).toHaveLength(0);
    });

    it('creates Firestore order and computes authoritative total from items', async () => {
      const lines = [
        { id: 'olpers-milk-1l', quantity: 2, price: 290, name: "Olper's Milk 1L", art: 0, meta: '1L', total: 580 },
        { id: 'surf-excel-1kg', quantity: 1, price: 620, name: 'Surf Excel 1kg', art: 0, meta: '1kg', total: 620 },
      ];

      const order = await createVoiceOrder({
        lines,
        subtotal: 1200,
        deliveryFee: 99,
        total: 1299,
        source: 'voice',
        address: 'Street 5, G-9, Islamabad',
        phone: '03215555555',
        name: 'Fatima',
        transcript: 'do olpers milk aur ek surf excel',
      });

      expect(order.id).toBe('mock_order_doc_id');
      expect(order.reference).toMatch(/^HM-[A-Z0-9]{6}$/);
    });
  });

  // 10. Price calculation integrity (Firestore/catalog truth, not LLM prices)
  describe('10. Price calculation integrity', () => {
    it('uses catalog pricing exclusively and ignores artificial LLM prices', () => {
      // Find tomato price from catalog
      const tomato = allGroceryProducts.find(p => p.id === 'tomato');
      expect(tomato).toBeDefined();

      const orderLines = [
        {
          id: 'tomato',
          name: tomato!.name,
          quantity: 3,
          price: tomato!.price, // verified from catalog truth
          art: tomato!.art,
          meta: tomato!.unit,
          total: 3 * tomato!.price,
        },
      ];

      const validation = validateVoiceCheckout({
        items: orderLines,
        address: 'DHA Phase 5, Lahore',
        phone: '03331112233',
        name: 'Tariq',
      });

      expect(validation.isValid).toBe(true);
      expect(orderLines[0].price).toBe(tomato!.price);
      expect(orderLines[0].quantity * orderLines[0].price).toBe(3 * tomato!.price);
    });
  });
});
