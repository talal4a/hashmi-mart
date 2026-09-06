import { Image, View } from 'react-native';

/** Each product uses one cell of the locally bundled photographic contact sheet. */
export default function ProduceArt({
  index,
  size,
  radius = 16,
}: {
  index: number;
  size: number;
  radius?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        overflow: 'hidden',
        borderRadius: radius,
      }}
    >
      <Image
        source={require('../../assets/images/home/produce-sheet.png')}
        accessibilityIgnoresInvertColors
        style={{
          position: 'absolute',
          width: size * 3,
          height: size * 2,
          left: -(index % 3) * size,
          top: -Math.floor(index / 3) * size,
        }}
        resizeMode="stretch"
      />
    </View>
  );
}
