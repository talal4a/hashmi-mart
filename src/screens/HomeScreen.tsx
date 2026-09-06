import { useRef } from 'react';
import { BlurTargetView } from 'expo-blur';
import HomeBottomNav, {
  TAB_BAR_HEIGHT,
  TAB_BAR_GAP,
} from '../components/home/HomeBottomNav';
import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SectionHeader from '../components/home/SectionHeader';
import {
  ActionGrid,
  FreshProductCard,
  HeroBanner,
  HomeHeader,
  HomeRail,
  HomeSearchBar,
  VendorCard,
  VoiceOrderCard,
  WhatsAppButton,
} from '../components/home/GroceryHome';
import { freshPicks, nearbyVendors } from '../data/groceryHome';
import { grocery } from '../components/home/groceryTheme';

/** Reference-led, static Home mockup. Controls intentionally have no app actions. */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const blurTarget = useRef<View>(null);
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
            <HomeSearchBar />
            <VoiceOrderCard />
          </View>
          <View style={s.inset}>
            <HeroBanner />
          </View>
          <View style={s.inset}>
            <SectionHeader title="What do you need today?" />
            <ActionGrid />
          </View>
          <View style={s.section}>
            <SectionHeader title="Popular Near You" actionLabel="See all" />
            <HomeRail>
              {nearbyVendors.map(item => (
                <VendorCard key={item.name} item={item} />
              ))}
            </HomeRail>
          </View>
          <View style={s.section}>
            <SectionHeader title="Today's fresh picks" actionLabel="See all" />
            <HomeRail>
              {freshPicks.map(item => (
                <FreshProductCard key={item.id} item={item} />
              ))}
            </HomeRail>
          </View>
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
  inset: { paddingHorizontal: 18, gap: 14 },
  section: { gap: 6 },
});
