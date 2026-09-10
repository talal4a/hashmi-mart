import type { OrderLine } from '../../../services/orders';

/** Immutable customer-facing snapshot returned only after the order is saved. */
export type ReceiptOrder = {
  id: string;
  reference: string;
  createdAt: number;
  lines: readonly OrderLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  name: string;
  phone: string;
  address: string;
  area: string;
  instructions: string;
  source: 'voice' | 'browse';
};
