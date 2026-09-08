import { memo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { selectCartCount, useCartStore } from '../../stores/cartStore';
import CartBadge from './CartBadge';
import { cartHaptic, useCartFeedback } from './CartFeedbackProvider';
import { useCartReaction } from './useCartReaction';

const cartAsset =
  Platform.OS === 'android'
    ? require('../../assets/cart/cart-center.webp')
    : require('../../assets/cart/cart-center.png');

export default memo(function AnimatedCartNavButton({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}) {
  const count = useCartStore(selectCartCount);
  const feedback = useCartFeedback();
  const fallbackReaction = useSharedValue(0);
  const { cartStyle, onPressIn, onPressOut } = useCartReaction({
    reaction: feedback?.reaction ?? fallbackReaction,
    enabled: feedback?.enabled ?? false,
    reduced: feedback?.reduced ?? true,
  });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cart"
      accessibilityValue={{
        text: `${count} ${count === 1 ? 'item' : 'items'}`,
      }}
      accessibilityState={{ selected: active }}
      testID="home-cart"
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => {
        onPressOut();
        cartHaptic();
        onPress();
      }}
      style={s.button}
    >
      <View
        pointerEvents="none"
        style={[s.pedestal, active && s.pedestalActive]}
      />
      <View pointerEvents="none" style={[s.shadow, active && s.shadowActive]} />
      <Animated.View pointerEvents="none" style={[s.cart, cartStyle]}>
        <Image
          source={cartAsset}
          defaultSource={cartAsset}
          resizeMode="contain"
          fadeDuration={0}
          accessible={false}
          accessibilityIgnoresInvertColors
          style={s.image}
        />
        {/* This marker lies in the rendered basket opening, not the dock centre.
            It moves with the cart and is measured afresh for every flight. */}
        <View ref={feedback?.basketRef} collapsable={false} style={s.basket} />
      </Animated.View>
      <CartBadge />
      <Text
        style={[s.label, active && s.labelActive]}
        maxFontSizeMultiplier={1.4}
      >
        Cart
      </Text>
    </Pressable>
  );
});

const s = StyleSheet.create({
  button: { width: 88, height: 100, alignItems: 'center' },
  cart: { position: 'absolute', top: 0, width: 80, height: 80 },
  image: { width: 80, height: 80 },
  basket: { position: 'absolute', left: 39, top: 29, width: 2, height: 2 },
  pedestal: {
    position: 'absolute',
    top: 53,
    width: 56,
    height: 22,
    borderRadius: 16,
    backgroundColor: '#DFF5FBE8',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  pedestalActive: { backgroundColor: '#BBEAF7', borderColor: '#ECFCFF' },
  shadow: {
    position: 'absolute',
    top: 68,
    width: 43,
    height: 5,
    borderRadius: 24,
    backgroundColor: '#244D631C',
  },
  shadowActive: { backgroundColor: '#244D632B' },
  label: {
    position: 'absolute',
    top: 80,
    fontSize: 10,
    fontWeight: '600',
    color: '#447E96',
    letterSpacing: -0.1,
  },
  labelActive: { color: '#087FAD', fontWeight: '800' },
});
