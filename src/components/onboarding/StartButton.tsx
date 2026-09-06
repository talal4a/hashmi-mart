/**
 * The Start pill.
 *
 * Unchanged from the screen it came out of — same white pill, same cyan cart badge,
 * same chevron — but now driven by a beat from the scene's timeline instead of its
 * own mount timer, so it lands as part of the sequence rather than in parallel
 * with it. `onPress` stays optional: this is design-only, and nothing here knows
 * what happens next.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { ShoppingCart } from 'lucide-react-native';
import { c, type as typeTokens } from '../../theme/design';
import { useRise } from './useRise';

type Props = {
  progress: SharedValue<number>;
  onPress?: () => void;
};

export default function StartButton({ progress, onPress }: Props) {
  const style = useRise(progress, 24);

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Start"
        style={styles.pill}
      >
        <View style={[styles.badge, styles.badgeSolid]}>
          <ShoppingCart size={22} color={c.white} strokeWidth={2.5} />
        </View>
        <Text style={styles.label}>Start</Text>
        <View style={[styles.badge, styles.badgeTint]}>
          <Text style={styles.chevron}>›</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    padding: 8,
    backgroundColor: c.white,
    shadowColor: c.ink,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  badge: {
    height: 48,
    width: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSolid: { backgroundColor: c.cyan },
  badgeTint: { backgroundColor: c.cyanTint },
  label: {
    ...typeTokens.title,
    flex: 1,
    marginHorizontal: 16,
    textAlign: 'center',
    fontSize: 16,
    letterSpacing: 0.3,
    color: c.ink,
  },
  chevron: { fontSize: 20, fontWeight: '700', color: c.cyan },
});
