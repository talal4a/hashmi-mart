import { Linking } from 'react-native';
import {
  SUPPORT_PHONE_E164,
  SUPPORT_WHATSAPP_MESSAGE,
} from '../config/support';

/**
 * Opens WhatsApp on the support number with the message already typed.
 *
 * `wa.me` rather than the `whatsapp://` scheme on purpose. The custom scheme
 * fails outright on a phone without WhatsApp installed, which is the one case
 * worth handling well; the https link hands that user to the web fallback
 * instead, and on a phone that *does* have it the OS routes it to the app
 * exactly the same way.
 *
 * Returns false rather than throwing, because every caller's answer to a failure
 * is the same — show the number and let the user dial it — and none of them can
 * do anything useful with the reason.
 */
export async function openWhatsApp(
  message: string = SUPPORT_WHATSAPP_MESSAGE,
): Promise<boolean> {
  const url = `https://wa.me/${SUPPORT_PHONE_E164}?text=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
