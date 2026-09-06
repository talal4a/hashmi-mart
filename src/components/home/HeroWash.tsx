import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/** Soft cyan wash behind the header that dissolves into the page. */
export default function HeroWash({ height = 380 }: { height?: number }) {
  return (
    <Svg style={[s.wash, { height }]} pointerEvents="none">
      <Defs>
        <LinearGradient id="heroWash" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B3ECFA" stopOpacity="1" />
          <Stop offset="0.35" stopColor="#D6F4FD" stopOpacity="0.9" />
          <Stop offset="0.65" stopColor="#EEF9FE" stopOpacity="0.5" />
          <Stop offset="1" stopColor="#F8F9FA" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroWash)" />
    </Svg>
  );
}

const s = StyleSheet.create({
  wash: { position: 'absolute', top: 0, left: 0, right: 0 },
});
