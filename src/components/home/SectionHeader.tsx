import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { c, type } from '../../theme/design';
import Icon from '../ui/Icon';
import { HOME_GUTTER } from './groceryTheme';

type Props = {
  title: string;
  /** One quiet line under the title, for context the title should not carry. */
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const spring = { damping: 16, stiffness: 320, mass: 0.5 };

export default function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: Props) {
  const scale = useSharedValue(1);
  const nudge = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  const pill = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  // The chevron leans into the direction it is about to take you.
  const chevron = useAnimatedStyle(() => ({
    transform: [{ translateX: nudge.value }],
  }));

  const dip = (down: boolean) => {
    if (reducedMotion) return;
    scale.value = withSpring(down ? 0.94 : 1, spring);
    nudge.value = withSpring(down ? 3 : 0, spring);
  };

  return (
    <View style={s.row}>
      <View style={s.headings}>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel ? (
        <Animated.View style={pill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel}, ${title}`}
            onPressIn={() => dip(true)}
            onPressOut={() => dip(false)}
            onPress={onAction}
            hitSlop={8}
            style={s.action}
          >
            <Text style={s.actionText}>{actionLabel}</Text>
            <Animated.View style={chevron}>
              <Icon name="chevron" size={12} color={c.cyanDeep} weight="bold" />
            </Animated.View>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: HOME_GUTTER,
  },
  headings: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...type.section, fontSize: 20 },
  subtitle: { ...type.caption, fontSize: 11.5, color: c.secondary },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: c.cyanTint,
  },
  actionText: {
    ...type.micro,
    fontSize: 12,
    fontWeight: '700',
    color: c.cyanDeep,
    letterSpacing: -0.2,
  },
});
