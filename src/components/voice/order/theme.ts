import { StyleSheet } from 'react-native';

/**
 * One palette for the voice sheet, so a panel can be moved without carrying a
 * private set of hexes with it.
 *
 * `shelf` is amber rather than red on purpose: an item we do not stock is a
 * fact about the shop, not a mistake the customer made, and colouring it like
 * an error tells them off for asking.
 */
export const C = {
  ink: '#0B2936',
  muted: '#688493',
  cyan: '#08ACE0',
  cyanDeep: '#037FA8',
  canvas: '#F2FAFD',
  paper: '#FFFFFF',
  line: '#DFEDF3',
  pale: '#E6F5FC',
  good: '#237C54',
  goodPale: '#E8F8EE',
  shelf: '#9A6B24',
  shelfPale: '#FDF3E3',
} as const;

export const text = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.9,
    color: C.ink,
    textAlign: 'center',
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
    color: C.muted,
    textAlign: 'center',
  },
  label: {
    color: C.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

/** The two buttons every panel ends with, so they are the same button. */
export const buttons = StyleSheet.create({
  primary: {
    backgroundColor: C.ink,
    minHeight: 54,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
  },
  primaryText: { color: C.paper, fontSize: 15, fontWeight: '700' },
  secondary: {
    minHeight: 48,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    backgroundColor: '#E5F3F9',
  },
  secondaryText: { color: C.ink, fontSize: 13, fontWeight: '600' },
});
