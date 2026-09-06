/**
 * One icon vocabulary for the whole app.
 *
 * `Icon` resolves per platform (Metro picks Icon.ios.tsx / Icon.android.tsx):
 *   iOS     -> real SF Symbols via expo-symbols
 *   Android -> the closest lucide-react-native glyph
 *
 * Add a name here first, then map it in both platform files.
 */
export type IconName =
  | 'bell'
  | 'search'
  | 'pin'
  | 'plus'
  | 'chevron'
  | 'all'
  | 'fresh'
  | 'electronics'
  | 'beauty'
  | 'home'
  | 'categories'
  | 'reorder'
  | 'profile';

export type IconWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  weight?: IconWeight;
};

/** SF Symbol identifiers, used by Icon.ios.tsx. */
export const SF: Record<IconName, string> = {
  bell: 'bell',
  search: 'magnifyingglass',
  pin: 'mappin.and.ellipse',
  plus: 'plus',
  chevron: 'chevron.right',
  all: 'square.grid.2x2',
  fresh: 'leaf',
  electronics: 'headphones',
  beauty: 'sparkles',
  home: 'house',
  categories: 'square.grid.2x2',
  reorder: 'arrow.left.arrow.right',
  profile: 'person',
};
