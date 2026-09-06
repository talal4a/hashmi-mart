import { ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { c, radius, shadow, type, wells } from '../../theme/design';
import Icon from '../ui/Icon';
import PressableScale from '../ui/PressableScale';
import Visual from '../ui/Visual';

export type Product = {
  id: string;
  name: string;
  meta: string;
  price: string;
  wasPrice?: string;
  badge?: string;
  soldOut?: boolean;
  glyph: string;
  image?: ImageSourcePropType;
};

type Props = {
  product: Product;
  /** Fixed width for horizontal rails; omit inside a flex grid. */
  width?: number;
  /** Rotates the tinted well colour so a grid doesn't look flat. */
  tone?: number;
  onPress?: () => void;
  onAdd?: () => void;
};

export default function ProductCard({
  product,
  width,
  tone = 0,
  onPress,
  onAdd,
}: Props) {
  const { name, meta, price, wasPrice, badge, soldOut, glyph, image } = product;
  const well = wells[tone % wells.length];

  return (
    <PressableScale
      style={[s.card, width ? { width } : s.fluid]}
      onPress={onPress}
    >
      <View style={[s.well, { backgroundColor: well }]}>
        <Visual image={image} glyph={glyph} size={92} />
      </View>

      {badge || soldOut ? (
        <View style={[s.badge, soldOut && s.badgeMuted]}>
          <Text style={s.badgeText}>{soldOut ? 'Sold Out' : badge}</Text>
        </View>
      ) : null}

      <View style={s.addHalo}>
        <PressableScale style={s.add} scaleTo={0.88} onPress={onAdd}>
          <Icon name="plus" size={16} color={c.white} weight="bold" />
        </PressableScale>
      </View>

      <Text style={s.meta} numberOfLines={1}>
        {meta}
      </Text>
      <Text style={s.name} numberOfLines={1}>
        {name}
      </Text>

      <View style={[s.priceBar, soldOut && s.priceBarMuted]}>
        <Text style={s.price}>{price}</Text>
        {wasPrice ? <Text style={s.was}>(was {wasPrice})</Text> : null}
      </View>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  card: {
    padding: 10,
    paddingBottom: 11,
    borderRadius: radius.card,
    backgroundColor: c.white,
    ...shadow.card,
  },
  fluid: { alignSelf: 'stretch' },
  well: {
    height: 124,
    borderRadius: radius.well,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 18,
    left: 18,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: c.ink,
  },
  badgeMuted: { backgroundColor: c.secondary },
  badgeText: { ...type.micro, fontSize: 10.5, color: c.white },
  addHalo: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 5,
    borderRadius: radius.pill,
    backgroundColor: c.white,
  },
  add: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.cyan,
    ...shadow.accent,
  },
  meta: {
    ...type.caption,
    fontSize: 11.5,
    marginTop: 11,
    paddingHorizontal: 3,
  },
  name: { ...type.title, fontSize: 15, marginTop: 2, paddingHorizontal: 3 },
  priceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 44,
    marginTop: 11,
    borderRadius: radius.pill,
    backgroundColor: c.ink,
  },
  priceBarMuted: { backgroundColor: c.secondary },
  price: { ...type.title, fontSize: 15.5, color: c.white },
  was: { ...type.caption, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
});
