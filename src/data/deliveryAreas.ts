/**
 * Where HashmiMart delivers.
 *
 * A fixed list rather than a free-text field, because "Satellite Town",
 * "satellite twn" and "Sat. Town" are the same place to a customer and three
 * different places to whoever is routing the rider. The address line below it
 * stays free text — that is where the house and street go, and no list can
 * enumerate those.
 *
 * Placeholder coverage: these are Rawalpindi sectors. Replace with the real
 * delivery zones before launch; nothing else reads this file, so it is a
 * one-line change.
 */
export const DELIVERY_AREAS = [
  'Satellite Town',
  'Commercial Market',
  'Chaklala Scheme 3',
  'Westridge',
  'Saddar',
  'Bahria Town',
  'DHA Phase 2',
  'Gulraiz',
  'Peshawar Road',
  'Adiala Road',
  'Tench Bhata',
  'Morgah',
] as const;

export type DeliveryArea = (typeof DELIVERY_AREAS)[number];

export function isDeliveryArea(value: string): value is DeliveryArea {
  return (DELIVERY_AREAS as readonly string[]).includes(value);
}
