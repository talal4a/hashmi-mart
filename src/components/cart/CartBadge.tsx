import { memo } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { selectCartCount, useCartStore } from '../../stores/cartStore';
import { useCartFeedback } from './CartFeedbackProvider';

/** A scalar subscription keeps count updates out of the rest of the navbar. */
export default memo(function CartBadge() {
  const count = useCartStore(selectCartCount);
  const feedback = useCartFeedback();
  const scale = feedback?.badgeScale;
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale?.value ?? 1 }],
  }));
  if (!count) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      style={[s.badge, style]}
      testID="cart-badge"
    >
      <Text style={s.text} maxFontSizeMultiplier={1.2}>
        {count > 99 ? '99+' : count}
      </Text>
    </Animated.View>
  );
});
const s = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 2,
    right: 1,
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    paddingHorizontal: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#BFEAF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    color: '#087FAD',
    fontVariant: ['tabular-nums'],
  },
});
