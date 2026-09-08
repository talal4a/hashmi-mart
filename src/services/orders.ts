import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { SupportError } from './supportService';

/**
 * Placing an order.
 *
 * Deliberately the same shape as a voice order: a document the shop reads, a
 * reference the customer can read back over the phone, and prices written down
 * at the moment they were agreed rather than looked up again later. A price
 * that is recalculated at fulfilment is a price that can change after the
 * customer said yes.
 *
 * When the order came from speech the transcript rides along. Urdu and Punjabi
 * are matched against a small catalogue and the match is not always certain, so
 * the sentence the customer actually said is the thing that settles an argument
 * about what they meant.
 */

export type OrderLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderDraft = {
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  /** How the order was assembled, so voice orders can be audited as a group. */
  source: 'voice' | 'browse';
  transcript?: string | null;
  address: string;
  phone: string;
  name: string;
};

export type PlacedOrder = { id: string; reference: string };

/** Short, unambiguous out loud: no O/0 or I/1 confusion. */
const ALPHABET = '23456789ACDEFGHJKLMNPQRTUVWXYZ';

function reference(): string {
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `HM-${code}`;
}

export async function placeOrder(draft: OrderDraft): Promise<PlacedOrder> {
  const user = auth.currentUser;
  // `userId` comes from the session, never from an argument: a caller that can
  // pass a uid is a caller that can pass someone else's.
  if (!user) throw new SupportError('unauthenticated');
  if (!draft.lines.length) throw new SupportError('unavailable');

  const code = reference();

  try {
    const created = await addDoc(collection(db, 'orders'), {
      userId: user.uid,
      reference: code,
      status: 'placed',
      source: draft.source,
      ...(draft.transcript ? { transcript: draft.transcript } : null),
      items: draft.lines,
      subtotal: draft.subtotal,
      deliveryFee: draft.deliveryFee,
      total: draft.total,
      currency: 'PKR',
      payment: { method: 'cash_on_delivery', status: 'pending' },
      contact: {
        name: draft.name,
        phone: draft.phone,
        address: draft.address,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: created.id, reference: code };
  } catch {
    // The customer does not need to know whether this was rules, network or
    // quota; they need to know the order did not go through.
    throw new SupportError('unavailable');
  }
}
