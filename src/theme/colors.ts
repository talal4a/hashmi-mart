export const colors = {
  bg: '#ffffff',
  accent: '#06b6d4',
  accentHover: '#0891b2',
  accentEnd: '#06b6d4',
  accentEndHover: '#0891b2',
} as const;

export type ColorKey = keyof typeof colors;
