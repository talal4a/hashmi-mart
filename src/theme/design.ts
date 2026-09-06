import { Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * Design tokens for the HashmiMart UI.
 * Duotone system: deep ink + cyan blue on white / off-white. Nothing else.
 */
export const c = {
  // Brand
  cyan: '#00BFFF',
  cyanDeep: '#00A2D4',
  cyanTint: '#E4F6FF',
  cyanMist: '#F1FAFF',

  // Ink
  ink: '#0B2027',
  inkSoft: '#1B2B33',
  label: '#111A1F',
  secondary: '#7A8B92',
  tertiary: '#A7B4B9',

  // Surfaces
  white: '#FFFFFF',
  canvas: '#F8F9FA',
  hairline: 'rgba(11, 32, 39, 0.06)',
  glass: 'rgba(255, 255, 255, 0.72)',
} as const;

/** Alternating soft cyan wells behind product cut-outs, so the grid still breathes. */
export const wells = ['#E4F6FF', '#EEF9FD', '#E9F4F8', '#F1FAFF'] as const;

export const radius = {
  pill: 999,
  card: 26,
  well: 20,
  chip: 18,
  nav: 30,
} as const;

export const space = {
  gutter: 20,
  gap: 12,
  section: 26,
} as const;

/** iOS-flavoured shadows, with matching Android elevation. */
export const shadow = {
  card: {
    shadowColor: c.ink,
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  pill: {
    shadowColor: c.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  floating: {
    shadowColor: c.ink,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  accent: {
    shadowColor: c.cyanDeep,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
} satisfies Record<string, ViewStyle>;

/**
 * SF-like typography. Android gets the tightest tracking we can get away with,
 * which is what sells the "iOS on Android" feel more than anything else.
 */
const family = Platform.select({ ios: undefined, default: 'sans-serif' });
const familyMedium = Platform.select({
  ios: undefined,
  default: 'sans-serif-medium',
});

export const type = {
  display: {
    fontFamily: family,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.7,
    color: c.label,
  },
  section: {
    fontFamily: family,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: c.label,
  },
  title: {
    fontFamily: familyMedium,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: c.label,
  },
  body: {
    fontFamily: family,
    fontSize: 15,
    letterSpacing: -0.2,
    color: c.label,
  },
  caption: {
    fontFamily: family,
    fontSize: 12,
    letterSpacing: -0.1,
    color: c.secondary,
  },
  micro: {
    fontFamily: familyMedium,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
} satisfies Record<string, TextStyle>;
