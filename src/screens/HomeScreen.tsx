import { useCallback, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurTargetView } from 'expo-blur';
import HomeBottomNav, {
  TAB_BAR_HEIGHT,
  TAB_BAR_GAP,
  TAB_BAR_RISE,
} from '../components/home/HomeBottomNav';
import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CartPreview from '../components/home/CartPreview';
import { CartFlightProvider } from '../components/home/cartFlight';
import { useCart } from '../state/cart';
import VoiceOrderFlow from '../components/voice/VoiceOrderFlow';
import SectionHeader from '../components/home/SectionHeader';
import { Rail, RailItem, SectionReveal } from '../components/home/rail/Rail';
import VendorCard, { VENDOR_CARD_WIDTH } from '../components/home/VendorCard';
import FreshProductCard, {
  PRODUCT_CARD_WIDTH,
} from '../components/home/FreshProductCard';
import {
  ActionGrid,
  HeroBanner,
  HomeHeader,
  HomeSearchBar,
  VoiceOrderCard,
  WhatsAppButton,
} from '../components/home/GroceryHome';
import { freshPicks, nearbyVendors } from '../data/groceryHome';
import { grocery, HOME_GUTTER } from '../components/home/groceryTheme';
import type { RootStackParamList } from '../navigation/RootNavigator';

/**
 * Reference-led Home. Most controls are still mockup; the two support entry
 * points are not — the AI button opens Hashmi AI and the floating green button
 * opens WhatsApp, which is what PRD section 10 asks the app to keep reachable.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const blurTarget = useRef<View>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  // The cart lives above the navigator now, because Checkout is a route and a
  // basket held in this screen's state could not be carried to it.
  const { quantities, count: cartCount, adjust: adjustQuantity } = useCart();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const openSupport = useCallback(
    () => navigation.navigate('Support'),
    [navigation],
  );
  return (
    // Wraps the whole screen so the flight overlay sits above the bar: the item
    // has to stay visible right up to the basket, and a layer beneath the nav
    // would clip it exactly where it matters.
    <CartFlightProvider>
      <View style={s.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#E8F7FF" />
        <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
          <LinearGradient colors={['#E0F5FF', grocery.canvas]} style={s.wash} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              s.content,
              {
                paddingTop: insets.top + 12,
                // The bar floats over the page, so the page has to end above it:
                // its height, the cart's protrusion, the gap under the dock, the
                // home indicator, and then real breathing room. 24 left cards
                // crowding the bar; 40 is a clear band.
                paddingBottom:
                  TAB_BAR_HEIGHT +
                  TAB_BAR_RISE +
                  insets.bottom +
                  TAB_BAR_GAP +
                  40,
              },
            ]}
          >
            <View style={s.inset}>
              <HomeHeader />
              <HomeSearchBar onOpenSupport={openSupport} />
              <VoiceOrderCard onPress={() => setVoiceOpen(true)} />
            </View>
            <View style={s.inset}>
              <HeroBanner />
            </View>
            <View style={s.inset}>
              <SectionHeader title="What do you need today?" />
              <ActionGrid />
            </View>
            <SectionReveal delay={60}>
              <View style={s.section}>
                <SectionHeader
                  title="Popular near you"
                  subtitle={`${nearbyVendors.length} stores delivering to your area`}
                  actionLabel="See all"
                />
                <Rail itemWidth={VENDOR_CARD_WIDTH} gap={12}>
                  {nearbyVendors.map((item, index) => (
                    <RailItem key={item.id} index={index}>
                      <VendorCard item={item} />
                    </RailItem>
                  ))}
                </Rail>
              </View>
            </SectionReveal>
            <SectionReveal delay={140}>
              <View style={s.section}>
                <SectionHeader
                  title="Today's fresh picks"
                  subtitle="Picked this morning, priced for today"
                  actionLabel="See all"
                />
                <Rail itemWidth={PRODUCT_CARD_WIDTH} gap={12}>
                  {freshPicks.map((item, index) => (
                    <RailItem key={item.id} index={index}>
                      <FreshProductCard
                        item={item}
                        quantity={quantities[item.id] ?? 0}
                        onAdjust={delta => adjustQuantity(item.id, delta)}
                      />
                    </RailItem>
                  ))}
                </Rail>
              </View>
            </SectionReveal>
          </ScrollView>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: insets.top,
              backgroundColor: '#E0F5FF',
            }}
          />
        </BlurTargetView>
        <WhatsAppButton
          style={{
            position: 'absolute',
            right: 18,
            bottom:
              TAB_BAR_HEIGHT + TAB_BAR_RISE + TAB_BAR_GAP + insets.bottom + 20,
          }}
        />
        <HomeBottomNav
          blurTarget={blurTarget}
          cartCount={cartCount}
          onOpenCart={() => setCartOpen(true)}
        />
        {/* Owns what happens after a spoken order is confirmed: the items
            fly into the cart, then checkout opens. */}
        <VoiceOrderFlow
          visible={voiceOpen}
          onClose={() => setVoiceOpen(false)}
        />
        <CartPreview
          visible={cartOpen}
          quantities={quantities}
          onAdjust={adjustQuantity}
          onClose={() => setCartOpen(false)}
        />
      </View>
    </CartFlightProvider>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: grocery.canvas },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 500 },
  content: { gap: 14 },
  inset: { paddingHorizontal: HOME_GUTTER, gap: 14 },
  section: { gap: 4 },
});
