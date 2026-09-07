import { Platform, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from '../ui/PressableScale';
import HashmiAvatar, { type AvatarState } from './HashmiAvatar';
import { WhatsAppHeaderButton } from './WhatsAppButton';
import { support } from './supportTheme';

/**
 * Back, identity, and the human escape hatch — in that order of prominence.
 *
 * PRD section 10 asks for the WhatsApp number to stay visible but "visually
 * secondary to Hashmi AI", which is the whole layout brief. The assistant gets
 * the avatar, the name, the online dot and the languages; WhatsApp gets a 34px
 * logo and 10px type in the corner. It is unmissable and it is not competing.
 *
 * The language line is not decoration either: a user who does not know they may
 * write in Urdu will write in English, and the entire point of section 5 is that
 * they should not have to.
 */

type Props = {
  onBack: () => void;
  /** Drives the avatar's ring and pulse; mirrors the conversation's state. */
  avatarState?: AvatarState;
};

export default function SupportHeader({ onBack, avatarState = 'idle' }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 8 }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        scaleTo={0.88}
        hitSlop={10}
        style={s.back}
      >
        <ChevronLeft size={24} color={support.ink} strokeWidth={2.2} />
      </PressableScale>

      <View style={s.identity}>
        <HashmiAvatar size={40} state={avatarState} />
        <View style={s.identityText}>
          <Text style={s.name} numberOfLines={1}>
            Hashmi AI Support
          </Text>
          <View style={s.statusRow}>
            <View style={s.onlineDot} />
            <Text style={s.status}>Online</Text>
          </View>
          <Text style={s.languages} numberOfLines={1}>
            Urdu • Punjabi • English
          </Text>
        </View>
      </View>

      <WhatsAppHeaderButton />
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CFE8F5',
    backgroundColor: Platform.OS === 'android' ? '#EDF8FE' : '#EDF8FEEE',
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  identityText: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 15.5,
    fontWeight: '700',
    color: support.ink,
    letterSpacing: -0.3,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  status: { fontSize: 11, fontWeight: '600', color: '#3E8E5C' },
  languages: { fontSize: 10.5, color: support.faint, marginTop: 1 },
});
