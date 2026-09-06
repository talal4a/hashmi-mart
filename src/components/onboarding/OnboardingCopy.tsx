/**
 * The headline and the line under it.
 *
 * Two beats, not one: the subtitle follows the title by 140ms, which is enough for
 * the eye to finish the big line before the small one asks for attention, and not
 * enough to read as two separate events.
 */
import { StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { c, type as typeTokens } from '../../theme/design';
import { useRise } from './useRise';

type Props = {
  title: string;
  subtitle: string;
  titleProgress: SharedValue<number>;
  subtitleProgress: SharedValue<number>;
};

export default function OnboardingCopy({
  title,
  subtitle,
  titleProgress,
  subtitleProgress,
}: Props) {
  const titleStyle = useRise(titleProgress);
  const subtitleStyle = useRise(subtitleProgress, 14);

  return (
    <Animated.View style={styles.block}>
      <Animated.Text style={[styles.title, titleStyle]}>{title}</Animated.Text>
      <Animated.View style={subtitleStyle}>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { paddingTop: 24 },
  title: {
    ...typeTokens.display,
    fontSize: 30,
    letterSpacing: -0.8,
    lineHeight: 36,
    color: c.white,
  },
  subtitle: {
    ...typeTokens.body,
    marginTop: 12,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.85)',
  },
});
