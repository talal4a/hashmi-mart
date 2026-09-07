import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import PressableScale from '../ui/PressableScale';
import { openWhatsApp } from '../../utils/whatsapp';
import { SUPPORT_PHONE_DISPLAY } from '../../config/support';
import { tapHandoff } from '../voice/haptics';
import { support } from './supportTheme';

/**
 * The WhatsApp escape hatch, in the two shapes the screen needs.
 *
 * The client's requirement is that the logo *and* the number both work (PRD
 * section 10), so both live here rather than in whichever component happened to
 * draw them — that way there is one definition of what a WhatsApp tap does, and
 * a failure to open is handled the same way in the header as it is in the
 * handoff card.
 *
 * WhatsApp is never opened without a tap. That is a rule from section 10, and
 * also just true: an app that launches another app on its own has taken the
 * conversation away from the user.
 */

const GLYPH =
  'M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z';

export function WhatsAppGlyph({ size = 20, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d={GLYPH} fill={color} />
    </Svg>
  );
}

/**
 * Every WhatsApp tap in the feature goes through this.
 *
 * A failed `openURL` means WhatsApp is not installed — the common case on a
 * cheap Android handset — and section 6.1 asks for "a friendly fallback action
 * rather than failing silently". Showing the number in an alert is that: it is
 * the one thing the user can still act on, and it is copyable from the alert on
 * both platforms.
 */
export function useWhatsAppHandoff(message?: string) {
  const [opening, setOpening] = useState(false);
  const open = useCallback(async () => {
    if (opening) return;
    setOpening(true);
    tapHandoff();
    const opened = await openWhatsApp(message);
    if (!opened) {
      Alert.alert(
        'WhatsApp is not available',
        `You can reach HashmiMart support on ${SUPPORT_PHONE_DISPLAY}.`,
      );
    }
    setOpening(false);
  }, [message, opening]);
  return open;
}

/** Header form: the round green logo with the number underneath. */
export function WhatsAppHeaderButton({ message }: { message?: string }) {
  const open = useWhatsAppHandoff(message);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Contact HashmiMart support on WhatsApp, ${SUPPORT_PHONE_DISPLAY}`}
      accessibilityHint="Opens WhatsApp with a message ready to send"
      onPress={open}
      scaleTo={0.9}
      hitSlop={8}
      style={s.headerWrap}
    >
      <View style={s.logo}>
        <WhatsAppGlyph size={19} />
      </View>
      <Text style={s.number}>{SUPPORT_PHONE_DISPLAY}</Text>
    </PressableScale>
  );
}

/** Conversation form: the full-width "Continue on WhatsApp" action. */
export function WhatsAppContinueButton({ message }: { message?: string }) {
  const open = useWhatsAppHandoff(message);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Continue on WhatsApp"
      onPress={open}
      scaleTo={0.97}
      style={s.continue}
    >
      <WhatsAppGlyph size={17} />
      <Text style={s.continueText}>Continue on WhatsApp</Text>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  headerWrap: { alignItems: 'center', gap: 3 },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: support.whatsapp,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontSize: 10,
    fontWeight: '600',
    color: support.muted,
    letterSpacing: -0.1,
  },
  continue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: support.whatsapp,
  },
  continueText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
