import { useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurTargetView } from 'expo-blur';
import HomeBottomNav, {
  TAB_BAR_HEIGHT,
  TAB_BAR_GAP,
} from '../components/home/HomeBottomNav';
import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const openSupport = useCallback(
    () => navigation.navigate('Support'),
    [navigation],
  );
  return (
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
              paddingBottom: TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_GAP + 24,
            },
          ]}
        >
          <View style={s.inset}>
            <HomeHeader />
            <HomeSearchBar onOpenSupport={openSupport} />
            <VoiceOrderCard />
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
                    <FreshProductCard item={item} />
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
          bottom: TAB_BAR_HEIGHT + TAB_BAR_GAP + insets.bottom + 20,
        }}
      />
      <HomeBottomNav blurTarget={blurTarget} />
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: grocery.canvas },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 500 },
  content: { gap: 14 },
  inset: { paddingHorizontal: HOME_GUTTER, gap: 14 },
  section: { gap: 4 },
});
