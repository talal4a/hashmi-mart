import { useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  ImageStyle,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

type Props = {
  /** Local `require(...)` or `{ uri }`. Falls back to the glyph if it fails to load. */
  image?: ImageSourcePropType;
  /** Emoji stand-in used until real product cut-outs are dropped in. */
  glyph: string;
  size: number;
  style?: ViewStyle;
};

/** Renders a product visual: real artwork when available, emoji otherwise. */
export default function Visual({ image, glyph, size, style }: Props) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };

  if (!image || failed) {
    return (
      <View style={[s.center, box, style]}>
        <Text style={{ fontSize: size * 0.72, lineHeight: size * 0.92 }}>
          {glyph}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={image}
      style={[box, style as ImageStyle]}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
