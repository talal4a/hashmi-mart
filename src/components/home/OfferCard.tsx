import { useId } from 'react';
import { ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { c, radius, shadow, type } from '../../theme/design';
import PressableScale from '../ui/PressableScale';
import Visual from '../ui/Visual';

export type Offer = {
  id: string;
  prefix: string;
  discount: string;
  category: string;
  glyph: string;
  image?: ImageSourcePropType;
};

type Props = { offer: Offer; onPress?: () => void };

export default function OfferCard({ offer, onPress }: Props) {
  // Unique gradient id so several cards can live on one screen safely.
  const gradientId = `offer-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <PressableScale style={s.card} onPress={onPress}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor="#FBFEFF" />
            <Stop offset="1" stopColor="#CFEDFA" />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={`url(#${gradientId})`}
        />
      </Svg>

      <View style={s.copy}>
        <Text style={s.prefix}>{offer.prefix}</Text>
        <Text style={s.discount}>{offer.discount}</Text>
        <Text style={s.category}>{offer.category}</Text>
      </View>

      <Visual
        image={offer.image}
        glyph={offer.glyph}
        size={76}
        style={s.visual}
      />
    </PressableScale>
  );
}

const s = StyleSheet.create({
  card: {
    width: 158,
    height: 176,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    ...shadow.pill,
  },
  copy: { paddingTop: 15, paddingHorizontal: 15 },
  prefix: { ...type.caption, fontSize: 12, color: c.secondary },
  discount: { ...type.section, fontSize: 20, marginTop: -1 },
  category: { ...type.caption, fontSize: 12.5, marginTop: 2, color: c.inkSoft },
  visual: { position: 'absolute', right: 10, bottom: 8 },
});
