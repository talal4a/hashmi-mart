import { freshPicks } from '../data/groceryHome';
import { isDeliveryAreaSupported, DELIVERY_AREAS } from './deliveryAreas';

export const DELIVERY_FEE = 99;
export const FREE_DELIVERY_THRESHOLD = 1500;

export type CheckoutCatalogItem = {
  id: string;
  name: string;
  unit: string;
  price: number;
  art: number;
  available: boolean;
};

const CATALOG_ITEMS: Record<string, { name: string; unit: string; price: number; art: number }> = {};
freshPicks.forEach(pick => {
  CATALOG_ITEMS[pick.id] = {
    name: pick.name,
    unit: pick.meta,
    price: pick.price,
    art: pick.art,
  };
});

export function getCheckoutCatalog(): CheckoutCatalogItem[] {
  return freshPicks.map(pick => ({
    id: pick.id,
    name: pick.name,
    unit: pick.meta,
    price: pick.price,
    art: pick.art,
    available: true,
  }));
}

export type PricingLine = {
  productId: string;
  quantity: number;
  unitPrice?: number;
};

export type PricingResult = {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
};

export function priceCheckout(lines: readonly PricingLine[]): PricingResult {
  let subtotal = 0;
  for (const line of lines) {
    const qty = line.quantity;
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 999) {
      throw new Error(`Invalid order quantity: ${qty}`);
    }
    const item = CATALOG_ITEMS[line.productId];
    const unitPrice = item ? item.price : (line.unitPrice ?? 120);
    subtotal += unitPrice * qty;
  }

  const deliveryFee = subtotal === 0 || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const discount = 0;
  const total = subtotal + deliveryFee - discount;

  return {
    subtotal,
    deliveryFee,
    discount,
    total,
  };
}

export type RevalidateLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type RevalidationResult = {
  priceChanges: Array<{
    productId: string;
    name: string;
    previousPrice: number;
    currentPrice: number;
  }>;
  unavailable: string[];
};

export function revalidateCheckout(lines: readonly RevalidateLine[]): RevalidationResult {
  const priceChanges: RevalidationResult['priceChanges'] = [];
  const unavailable: string[] = [];

  for (const line of lines) {
    const current = CATALOG_ITEMS[line.productId];
    if (!current) {
      unavailable.push(line.productId);
    } else if (current.price !== line.unitPrice) {
      priceChanges.push({
        productId: line.productId,
        name: current.name,
        previousPrice: line.unitPrice,
        currentPrice: current.price,
      });
    }
  }

  return { priceChanges, unavailable };
}

export function normalizeCheckoutPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('923') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('03') && digits.length === 11) {
    return `+92${digits.slice(1)}`;
  }
  if (digits.startsWith('3') && digits.length === 10) {
    return `+92${digits}`;
  }
  if (raw.trim().startsWith('+923') && digits.length === 12) {
    return `+${digits}`;
  }
  return raw.trim();
}

export type CheckoutContact = {
  name: string;
  phone: string;
  area: string;
  address: string;
  instructions?: string;
};

export function validateCheckoutContact(contact: CheckoutContact): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!contact.name || !contact.name.trim()) {
    errors.name = 'Please enter your name';
  }

  const normalizedPhone = normalizeCheckoutPhone(contact.phone || '');
  if (!contact.phone || !contact.phone.trim()) {
    errors.phone = 'Please enter a phone number';
  } else if (!/^\+923\d{9}$/.test(normalizedPhone)) {
    errors.phone = 'Please enter a valid Pakistan phone number (03xx-xxxxxxx)';
  }

  if (!contact.area || !contact.area.trim()) {
    errors.area = 'Please choose a delivery area';
  } else if (DELIVERY_AREAS.length > 0 && !isDeliveryAreaSupported(contact.area, DELIVERY_AREAS)) {
    errors.area = 'Delivery is not currently available in this area';
  }

  if (!contact.address || !contact.address.trim()) {
    errors.address = 'Please enter your street address';
  }

  return errors;
}
