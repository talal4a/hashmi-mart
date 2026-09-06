import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, radius, shadow, type } from '../../theme/design';
import Icon from '../ui/Icon';
import { IconName } from '../ui/icons';
import PressableScale from '../ui/PressableScale';

export type NavKey = 'home' | 'categories' | 'reorder' | 'profile';

const ITEMS: { key: NavKey; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'categories', label: 'Categories', icon: 'categories' },
  { key: 'reorder', label: 'Order again', icon: 'reorder' },
  { key: 'profile', label: 'Profile', icon: 'profile' },
];

type Props = { active: NavKey; onChange?: (key: NavKey) => void };

/** Floating frosted-glass tab bar. Android needs the experimental blur method to actually blur. */
export default function GlassBottomNav({ active, onChange }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[s.dock, { bottom: Math.max(insets.bottom, 10) + 6 }]}
      pointerEvents="box-none"
    >
      <BlurView
        intensity={Platform.OS === 'android' ? 70 : 42}
        tint="light"
        experimentalBlurMethod="dimezisBlurView"
        style={s.bar}
      >
        <View style={s.sheen} pointerEvents="none" />
        {ITEMS.map(item => {
          const isActive = item.key === active;
          return (
            <PressableScale
              key={item.key}
              style={s.item}
              scaleTo={0.9}
              onPress={() => onChange?.(item.key)}
            >
              <Icon
                name={item.icon}
                size={22}
                color={isActive ? c.cyanDeep : c.secondary}
                weight={isActive ? 'semibold' : 'medium'}
              />
              <Text
                style={[s.label, isActive && s.labelActive]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </PressableScale>
          );
        })}
      </BlurView>
    </View>
  );
}

const s = StyleSheet.create({
  dock: { position: 'absolute', left: 16, right: 16 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    paddingHorizontal: 6,
    borderRadius: radius.nav,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor:
      Platform.OS === 'android' ? 'rgba(255,255,255,0.55)' : 'transparent',
    ...shadow.floating,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 72,
  },
  label: {
    ...type.micro,
    fontSize: 10.5,
    color: c.secondary,
    letterSpacing: -0.1,
  },
  labelActive: { color: c.cyanDeep },
});
