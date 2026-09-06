import {
  ArrowLeftRight,
  Bell,
  Headphones,
  House,
  LayoutGrid,
  Leaf,
  type LucideIcon,
  MapPin,
  Plus,
  Search,
  Sparkles,
  User,
  ChevronRight,
} from 'lucide-react-native';
import { c } from '../../theme/design';
import { IconName, IconProps, IconWeight } from './icons';

/** Android: SF Symbols don't exist here, so lucide stands in with matching optical weight. */
const glyphs: Record<IconName, LucideIcon> = {
  bell: Bell,
  search: Search,
  pin: MapPin,
  plus: Plus,
  chevron: ChevronRight,
  all: LayoutGrid,
  fresh: Leaf,
  electronics: Headphones,
  beauty: Sparkles,
  home: House,
  categories: LayoutGrid,
  reorder: ArrowLeftRight,
  profile: User,
};

const strokes: Record<IconWeight, number> = {
  regular: 1.7,
  medium: 1.9,
  semibold: 2.2,
  bold: 2.6,
};

export default function Icon({
  name,
  size = 20,
  color = c.label,
  weight = 'semibold',
}: IconProps) {
  const Glyph = glyphs[name];
  return <Glyph size={size} color={color} strokeWidth={strokes[weight]} />;
}
