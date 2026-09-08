import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

/**
 * A shopping cart with volume, drawn rather than photographed.
 *
 * The outline glyph it replaces was flat because a single-weight stroke carries
 * no light: every edge is the same colour, so nothing reads as facing towards
 * or away from you. Three things fix that here, and none of them need a render.
 *
 * The rim is a separate, lighter trapezoid above the body. That is the top face
 * of the basket catching the light, and it is what tells the eye the tub is
 * open rather than solid.
 *
 * The body's gradient runs diagonally, light on the upper left and deep on the
 * lower right, so the tub reads as curved instead of as a flat panel. The tuck
 * under the rim is a second, darker pass — contact shade where the lip
 * overhangs, which is the cheapest possible ambient occlusion.
 *
 * The handle and wheels are solid shapes with their own gradients rather than
 * strokes, so they hold their form at 48px where a stroked wheel collapses into
 * a ring.
 *
 * Vector on purpose. It stays sharp at any size, weighs nothing, needs no
 * rebuild, and cannot arrive late and resize the bar — which a bitmap can.
 */

type Props = { size: number };

export default function CartMark({ size }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        {/* Top face: brightest surface, since it faces the light. */}
        <LinearGradient id="cartRim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#D7EFFA" />
        </LinearGradient>

        {/* Diagonal, so the tub turns away from the light rather than
            stepping down in bands. */}
        <LinearGradient id="cartBody" x1="0.05" y1="0" x2="0.95" y2="0.85">
          <Stop offset="0" stopColor="#EDF9FF" />
          <Stop offset="0.45" stopColor="#C6E6F6" />
          <Stop offset="1" stopColor="#8FC8E3" />
        </LinearGradient>

        <LinearGradient id="cartHandle" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5FD8FF" />
          <Stop offset="1" stopColor="#0A96D8" />
        </LinearGradient>

        <LinearGradient id="cartWheel" x1="0.25" y1="0" x2="0.75" y2="1">
          <Stop offset="0" stopColor="#54788C" />
          <Stop offset="1" stopColor="#22404F" />
        </LinearGradient>
      </Defs>

      {/* Handle, behind the basket so the tub overlaps where they meet. */}
      <Path
        d="M7 14 H14 C18.5 14 20.8 17.4 21.8 22"
        fill="none"
        stroke="url(#cartHandle)"
        strokeWidth={5}
        strokeLinecap="round"
      />

      {/* Body first, rim on top of it, so the lip sits proud. */}
      <Path d="M22 29 H55 L50 45 H27 Z" fill="url(#cartBody)" />
      {/* Shade tucked under the overhanging lip. */}
      <Path d="M22 29 H55 L54.4 31 H22.6 Z" fill="#6FB2D2" opacity={0.45} />

      <Path d="M19 22 H58 L55 30 H22 Z" fill="url(#cartRim)" />
      {/* The lit top edge of the lip. */}
      <Path
        d="M19.6 22.6 H57.2"
        stroke="#FFFFFF"
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.95}
      />

      {/* Legs. Short and thin — they only need to imply the axle. */}
      <Path
        d="M31 45 L32.5 48 M47 45 L45.5 48"
        stroke="#7FB6D0"
        strokeWidth={2.4}
        strokeLinecap="round"
      />

      <Circle cx={32} cy={52} r={5} fill="url(#cartWheel)" />
      <Circle cx={46} cy={52} r={5} fill="url(#cartWheel)" />
      {/* Specular dot, upper left on both, so the light stays consistent. */}
      <Circle cx={30.4} cy={50.2} r={1.5} fill="#FFFFFF" opacity={0.5} />
      <Circle cx={44.4} cy={50.2} r={1.5} fill="#FFFFFF" opacity={0.5} />
    </Svg>
  );
}
