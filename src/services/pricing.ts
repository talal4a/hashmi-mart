import type { CartLine } from '../state/cart';
import { productFor } from '../state/cart';

/**
 * What the order costs, worked out once.
 *
 * Three screens and a Firestore document quote these numbers, and the way that
 * goes wrong is not a crash: it is a receipt that says 2,480 under a button
 * that said 2,380, which the customer notices and nobody else does. So the
 * arithmetic lives here and every caller reads the same object.
 *
 * The one subtlety is the discount line. `price` in the catalogue is already
 * the reduced price, so a summary that showed `sum(price)` as the subtotal and
 * then *also* subtracted the saving would take the discount off twice. Subtotal
 * is therefore the list price — what these goods cost before the offers — and
 * the discount is the difference, which is the only arrangement where the three
 * lines add up to the total the customer is charged.
 */

/** Flat fee, waived on a basket big enough to be worth the trip. */
export const DELIVERY_FEE = 99;
export const FREE_DELIVERY_OVER = 1500;

export type OrderTotals = {
  /** Items, at list price, before offers. */
  subtotal: number;
  /** What the offers take off. Zero when nothing in the basket is reduced. */
  discount: number;
  /** Items at the price actually charged: `subtotal - discount`. */
  goods: number;
  deliveryFee: number;
  total: number;
  count: number;
  /** How much more is needed for the fee to be waived; 0 once it is. */
  toFreeDelivery: number;
};

export function priceOrder(lines: readonly CartLine[]): OrderTotals {
  let subtotal = 0;
  let goods = 0;
  let count = 0;

  for (const line of lines) {
    const product = productFor(line.id);
    // `was` is the price before the offer. Without one the list price is the
    // price, and the line simply contributes no discount.
    const list = product?.was ?? line.price;
    subtotal += list * line.quantity;
    goods += line.price * line.quantity;
    count += line.quantity;
  }

  const deliveryFee =
    goods >= FREE_DELIVERY_OVER || goods === 0 ? 0 : DELIVERY_FEE;

  return {
    subtotal,
    discount: subtotal - goods,
    goods,
    deliveryFee,
    total: goods + deliveryFee,
    count,
    toFreeDelivery: Math.max(0, FREE_DELIVERY_OVER - goods),
  };
}

/** `2480` → `Rs. 2,480`. One format, so no screen invents its own. */
export function money(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`;
}
