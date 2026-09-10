export const DEFAULT_DELIVERY_AREAS: readonly string[] = [
  'Satellite Town',
  'Peoples Colony',
  'Civil Lines',
  'Muslim Town',
  'Gulberg',
];

export function configuredDeliveryAreas(raw?: string): string[] {
  if (!raw) return [];
  const parts = raw.split(',').map(part => part.trim()).filter(Boolean);
  return Array.from(new Set(parts));
}

export const DELIVERY_AREAS = configuredDeliveryAreas(
  process.env.EXPO_PUBLIC_DELIVERY_AREAS,
);

export function isDeliveryAreaSupported(
  area: string,
  supportedAreas: readonly string[] = DELIVERY_AREAS,
): boolean {
  const trimmed = area.trim().toLowerCase();
  if (!trimmed || !supportedAreas.length) return false;
  return supportedAreas.some(supported => supported.trim().toLowerCase() === trimmed);
}
