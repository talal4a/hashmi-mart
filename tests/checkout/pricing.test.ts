import { priceOrder, money } from '../../src/services/pricing';
import type { CartLine } from '../../src/state/cart';

/**
 * The arithmetic three screens and a Firestore document all quote.
 *
 * The failure here is never a crash. It is a receipt that says one number
 * under a button that said another, which the customer notices and nobody
 * else does — so the property worth pinning is that the lines shown actually
 * add up to the total charged.
 */

const line = (id: string, price: number, quantity: number): CartLine => ({
  id,
  name: id,
  meta: '',
  price,
  art: 0,
  quantity,
  total: price * quantity,
});

describe('order pricing', () => {
  it('adds up: subtotal minus discount plus delivery is the total', () => {
    // Tomato lists at 150 and sells at 120; spinach lists at 100, sells at 90.
    const totals = priceOrder([line('tomato', 120, 2), line('spinach', 90, 1)]);

    expect(totals.subtotal).toBe(150 * 2 + 100);
    expect(totals.goods).toBe(120 * 2 + 90);
    expect(totals.discount).toBe(totals.subtotal - totals.goods);
    expect(totals.subtotal - totals.discount + totals.deliveryFee).toBe(
      totals.total,
    );
  });

  it('does not take the discount off twice', () => {
    // The catalogue price is already reduced, so a summary that showed it as
    // the subtotal and then subtracted the saving would undercharge by exactly
    // the discount — and it would still look plausible on screen.
    const totals = priceOrder([line('tomato', 120, 1)]);
    expect(totals.total).toBe(120 + totals.deliveryFee);
  });

  it('charges nothing for delivery on a big enough basket', () => {
    const small = priceOrder([line('tomato', 120, 1)]);
    expect(small.deliveryFee).toBeGreaterThan(0);
    expect(small.toFreeDelivery).toBeGreaterThan(0);

    const big = priceOrder([line('apple', 260, 8)]);
    expect(big.deliveryFee).toBe(0);
    expect(big.toFreeDelivery).toBe(0);
    expect(big.total).toBe(big.goods);
  });

  it('is zero everywhere on an empty basket, with no delivery fee', () => {
    // An empty cart charging 99 for delivery is the kind of thing that only
    // shows up on the screen nobody tests.
    const totals = priceOrder([]);
    expect(totals).toEqual(
      expect.objectContaining({ subtotal: 0, total: 0, deliveryFee: 0, count: 0 }),
    );
  });

  it('uses one money format everywhere', () => {
    expect(money(2480)).toBe('Rs. 2,480');
    expect(money(0)).toBe('Rs. 0');
  });
});
