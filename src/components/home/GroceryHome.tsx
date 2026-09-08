import Svg, { Path } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import {
  HeartbeatBar,
  HeartbeatRing,
  useVoiceHeartbeat,
} from './voiceHeartbeat';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowRight,
  Bell,
  Bot,
  ChevronRight,
  Leaf,
  Mic,
  Search,
} from 'lucide-react-native';
import VoiceOrderCopy from './VoiceOrderCopy';
import { useState } from 'react';
import { quickActions } from '../../data/groceryHome';
import { useWhatsAppHandoff } from '../support/WhatsAppButton';
import { grocery as c, softShadow } from './groceryTheme';

export function HomeHeader() {
  return (
    <View style={s.header}>
      <View style={s.headerTop}>
        <View style={[s.row, { flex: 1, minWidth: 0 }]}>
          <Image
            source={require('../../assets/images/cart-with-lines.png')}
            accessibilityIgnoresInvertColors
            style={{ width: 34, height: 34, marginRight: 2 }}
          />
          <Text
            style={[s.brand, { flexShrink: 1 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            Hashmi
            <Text style={{ color: '#087F9C', fontStyle: 'italic' }}>Mart</Text>
          </Text>
        </View>
        <View style={[s.row, { gap: 10 }]}>
          <View style={s.circle} accessibilityLabel="Notifications, unread">
            <Bell size={23} color={c.ink} />
            <View style={s.dot} />
          </View>
        </View>
      </View>
      <Text style={s.tagline}>Fresh Picks. Local Stores. Happy You.</Text>
    </View>
  );
}
export function HomeSearchBar({
  onOpenSupport,
}: {
  onOpenSupport?: () => void;
}) {
  const [barWidth, setBarWidth] = useState(0);
  // The white field curves around the 52px AI circle with a 6px gap.
  const centreX = barWidth - 26;
  const meetX = centreX - Math.sqrt(32 ** 2 - 28 ** 2);
  return (
    <View style={s.searchWrap}>
      <View
        style={s.searchInner}
        onLayout={({ nativeEvent }) => setBarWidth(nativeEvent.layout.width)}
      >
        {barWidth > 0 ? (
          <Svg width={barWidth} height={56} style={s.searchBg}>
            <Path
              d={`M28 0 H${meetX} A32 32 0 0 0 ${meetX} 56 H28 A28 28 0 0 1 0 28 A28 28 0 0 1 28 0 Z`}
              fill="#FFFFFF"
            />
          </Svg>
        ) : null}
        <View style={s.searchRow}>
          <Search size={23} color={c.muted} strokeWidth={1.8} />
          <Text numberOfLines={1} style={s.placeholder}>
            Search for groceries, stores, or anything...
          </Text>
        </View>
        <Pressable
          accessibilityLabel="AI support chat"
          accessibilityRole="button"
          onPress={onOpenSupport}
          style={s.aiBtn}
        >
          <Bot size={23} color="white" strokeWidth={1.8} />
        </Pressable>
      </View>
    </View>
  );
}
/**
 * Floating WhatsApp chat entry point, docked above the tab bar.
 *
 * The client requires WhatsApp to be reachable from the app, and this button was
 * previously a plain `View` — visible and inert. It now opens the same deep link
 * the Support screen uses, through the same helper, so there is one definition
 * of what a WhatsApp tap does and one fallback when WhatsApp is not installed.
 */
export function WhatsAppButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const open = useWhatsAppHandoff();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Chat with HashmiMart support on WhatsApp"
      onPress={open}
      style={[s.wa, style]}
    >
      <Svg width={26} height={26} viewBox="0 0 16 16">
        <Path
          d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"
          fill="white"
        />
      </Svg>
    </Pressable>
  );
}
const waveform = [12, 22, 36, 23, 13, 8, 18, 28, 38, 25, 13, 8, 18, 30, 19, 11];
export function VoiceOrderCard() {
  const { width } = useWindowDimensions();
  const { phase, micStyle } = useVoiceHeartbeat();
  const compact = width < 360;
  const micSize = compact ? 54 : 64;
  const stageWidth = Math.min(160, width * 0.29);
  return (
    <LinearGradient
      colors={['#F5FCFF', '#E9FAFF', '#F7FDFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.voice}
    >
      <View style={s.voiceCopy}>
        <Text style={[s.voiceTitle, compact && { fontSize: 17 }]}>
          Voice Order
        </Text>
        <View style={s.voiceDescriptionRow}>
          <VoiceOrderCopy />
          <View style={s.voiceArrow}>
            <ChevronRight size={17} color="#05B8F2" />
          </View>
        </View>
      </View>
      <View style={[s.voiceStage, { width: stageWidth }]}>
        <View pointerEvents="none" style={s.voiceWave}>
          {waveform.map((height, i) => (
            <HeartbeatBar
              key={i}
              phase={phase}
              index={i}
              count={waveform.length}
              height={height}
              color="#BAEEFD"
            />
          ))}
        </View>
        <View
          style={[
            s.voiceHalo,
            { width: micSize + 22, height: micSize + 22, borderRadius: 60 },
          ]}
        >
          <View
            style={[
              s.voiceInnerHalo,
              { width: micSize + 12, height: micSize + 12, borderRadius: 50 },
            ]}
          >
            <HeartbeatRing phase={phase} />
            <HeartbeatRing phase={phase} delay={0.035} />
            <Animated.View
              style={[
                s.voiceMic,
                { width: micSize, height: micSize, borderRadius: micSize / 2 },
                micStyle,
              ]}
            >
              <Mic size={compact ? 25 : 29} color="white" strokeWidth={2.6} />
            </Animated.View>
          </View>
        </View>
      </View>
      <View style={s.voiceNote}>
        <Text style={s.handwriting}>Try saying{'\n'}“Add milk”</Text>
        <Svg
          width={32}
          height={30}
          viewBox="0 0 32 30"
          style={{ marginTop: 3 }}
        >
          <Path
            d="M26 2 C27 15 20 24 6 24 M6 24 L11 19 M6 24 L12 28"
            fill="none"
            stroke="#718596"
            strokeWidth={1.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </LinearGradient>
  );
}
export function HeroBanner() {
  const { width } = useWindowDimensions();
  const height = Math.max(205, (width - 36) / 3);
  return (
    <View style={[s.banner, { minHeight: height }]}>
      <Image
        source={require('../../assets/images/home/farm-fresh-banner.png')}
        style={s.bannerPhoto}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['#EEF5DE', '#EEF5DEF5', '#EEF5DE00']}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.bannerCopy}>
        <View style={s.row}>
          <Leaf size={14} color={c.green} fill={c.green} />
          <Text style={s.farm}>Farm Fresh</Text>
        </View>
        <Text style={s.bannerTitle}>Real Food{'\n'}Brighter Days</Text>
        <Text style={s.bannerDetail}>
          Fresh groceries from trusted local stores{'\n'}delivered to your
          doorstep.
        </Text>
        <View style={s.cta}>
          <Text style={s.ctaText}>Shop Fresh</Text>
          <ArrowRight size={17} color="white" />
        </View>
      </View>
      <View style={s.discount}>
        <Text style={s.upTo}>UP TO</Text>
        <Text style={s.half}>50%</Text>
        <Text style={s.upTo}>OFF</Text>
      </View>
      <View style={s.dots}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[s.pageDot, { opacity: i === 0 ? 1 : 0.5 }]} />
        ))}
      </View>
    </View>
  );
}
/** The 2×2 quick-action grid under the hero banner. */
export function ActionGrid() {
  return (
    <View style={s.grid}>
      {quickActions.map(item => (
        <ActionTile key={item.name} item={item} />
      ))}
    </View>
  );
}
export function ActionTile({ item }: { item: (typeof quickActions)[number] }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View
      style={[s.tile, fontScale > 1.4 && s.tileLargeText]}
      accessible
      accessibilityLabel={`${item.name}. ${item.detail}`}
    >
      <LinearGradient
        colors={[item.from, item.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={s.tileSurface}
      />
      <View pointerEvents="none" style={s.tileArt}>
        <View style={[s.tileGroundShadow, { backgroundColor: item.accent }]} />
        <Image
          source={item.image}
          style={s.tileImage}
          resizeMode="contain"
          accessible={false}
          accessibilityIgnoresInvertColors
          fadeDuration={0}
        />
      </View>
      <View style={s.tileCopy}>
        <Text style={[s.tileTitle, { color: item.accent }]}>{item.name}</Text>
        <Text style={[s.tileDetail, { color: item.detailColor }]}>
          {item.detail}
        </Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  header: { gap: 2 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { color: c.ink, fontSize: 29, fontWeight: '800', letterSpacing: -1.2 },
  tagline: { color: c.muted, fontSize: 11, marginLeft: 42, marginTop: 1 },
  circle: {
    width: 44,
    height: 44,
    backgroundColor: 'white',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    ...softShadow,
  },
  dot: {
    position: 'absolute',
    right: 10,
    top: 7,
    width: 8,
    height: 8,
    borderRadius: 5,
    backgroundColor: '#FF443C',
    borderWidth: 1,
    borderColor: 'white',
  },
  searchWrap: { height: 56 },
  searchInner: { height: 56 },
  searchBg: { position: 'absolute', top: 0, left: 0 },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingLeft: 17,
    paddingRight: 80,
  },
  placeholder: { flex: 1, fontSize: 13, color: '#8A9AB1' },
  aiBtn: {
    position: 'absolute',
    right: 0,
    top: 2,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wa: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#25D366',
    borderWidth: 2.5,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
    elevation: 8,
  },
  voice: {
    minHeight: 106,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 18,
    paddingRight: 9,
    ...softShadow,
  },
  voiceCopy: { flex: 1, gap: 5 },
  voiceTitle: {
    color: c.ink,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  voiceDescriptionRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  voiceArrow: {
    width: 25,
    height: 25,
    borderRadius: 15,
    backgroundColor: '#DDF7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceStage: { height: 84, alignItems: 'center', justifyContent: 'center' },
  voiceWave: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceHalo: {
    backgroundColor: '#DFF7FD99',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceInnerHalo: {
    backgroundColor: '#B6EEFCBB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceMic: {
    backgroundColor: '#00B9F2',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceNote: { width: 62, alignItems: 'center', alignSelf: 'center' },
  handwriting: {
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy' : 'cursive',
    color: '#41586B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
    transform: [{ rotate: '-9deg' }],
  },
  banner: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#EEF5DE' },
  bannerPhoto: {
    position: 'absolute',
    right: 0,
    width: '100%',
    height: '100%',
  },
  bannerCopy: { padding: 19, width: '76%', gap: 7 },
  farm: { color: c.green, fontSize: 12, fontWeight: '600' },
  bannerTitle: {
    color: c.ink,
    fontSize: 27,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  bannerDetail: { color: c.ink, fontSize: 11, lineHeight: 16, maxWidth: 220 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 12,
    paddingHorizontal: 17,
    paddingVertical: 10,
    backgroundColor: '#043E35',
    borderRadius: 25,
    marginTop: 3,
  },
  ctaText: { color: 'white', fontSize: 12, fontWeight: '600' },
  discount: {
    position: 'absolute',
    right: 12,
    top: 13,
    backgroundColor: '#D2EA82E8',
    borderColor: '#F2FFC7',
    borderWidth: 2,
    width: 61,
    height: 61,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  upTo: { color: '#193415', fontSize: 10, fontWeight: '700' },
  half: { color: '#12250D', fontSize: 21, lineHeight: 23, fontWeight: '800' },
  dots: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  pageDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: 'white' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 42,
    paddingTop: 30,
    paddingBottom: 6,
  },
  tile: {
    width: '47.5%',
    minHeight: 198,
    paddingTop: 120,
    paddingHorizontal: 15,
    paddingBottom: 17,
    overflow: 'visible',
  },
  tileLargeText: { width: '100%' },
  tileSurface: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#365362',
    shadowOpacity: 0.09,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  tileArt: {
    position: 'absolute',
    top: -32,
    left: 0,
    right: 0,
    height: 148,
    alignItems: 'center',
  },
  tileGroundShadow: {
    position: 'absolute',
    bottom: 5,
    width: '64%',
    maxWidth: 124,
    height: 13,
    borderRadius: 80,
    opacity: 0.04,
    transform: [{ scaleY: 0.6 }],
  },
  tileImage: { width: '100%', maxWidth: 190, height: 148 },
  tileCopy: { gap: 5 },
  tileTitle: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  tileDetail: {
    color: '#425563',
    fontSize: 12,
    lineHeight: 17,
  },
});
