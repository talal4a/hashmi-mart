import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { c } from '../../theme/design';
import { IconProps, SF } from './icons';

/** iOS: genuine SF Symbols, monochrome-tinted. */
export default function Icon({
  name,
  size = 20,
  color = c.label,
  weight = 'semibold',
}: IconProps) {
  return (
    <SymbolView
      name={SF[name] as SymbolViewProps['name']}
      size={size}
      weight={weight}
      tintColor={color}
      type="monochrome"
      style={{ width: size, height: size }}
    />
  );
}
