import { memo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, RotateCcw, Settings } from 'lucide-react-native';
import PressableScale from '../../ui/PressableScale';
import type { VoiceAction } from './copy';
import { C, buttons } from './theme';

/**
 * The way out of a voice order that did not work.
 *
 * There are only ever two, and the order of them is the argument: the thing
 * most likely to fix it comes first, and carrying on with the recording comes
 * second — never the other way round, because a customer offered "send it to
 * the shop" as the top button will take it, and then wait for a phone call
 * instead of having a cart.
 *
 * The recording is never the consolation prize. It is the floor: whatever the
 * AI managed, the words the customer already said are still a complete order.
 */

function RepairActions({
  action,
  hasRecording,
  onRecord,
  onRetry,
  onKeepNote,
}: {
  action: VoiceAction;
  /** There is audio to carry to checkout. */
  hasRecording: boolean;
  onRecord: () => void;
  /** Runs the same recording through again — nothing is said twice. */
  onRetry: () => void;
  onKeepNote: () => void;
}) {
  const settings = action === 'settings';
  const retry = action === 'retry';
  return (
    <View style={s.actions}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={
          settings
            ? 'Open app settings'
            : retry
              ? 'Try this recording again'
              : 'Record your order again'
        }
        onPress={
          settings
            ? () => {
                void Linking.openSettings().catch(() => {});
              }
            : retry
              ? onRetry
              : onRecord
        }
        style={buttons.primary}
      >
        {settings ? (
          <Settings size={17} color={C.paper} />
        ) : (
          <RotateCcw size={17} color={C.paper} />
        )}
        <Text style={buttons.primaryText}>
          {settings ? 'Open settings' : retry ? 'Try again' : 'Say it again'}
        </Text>
      </PressableScale>
      {hasRecording && !settings ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Use my voice note at checkout"
          onPress={onKeepNote}
          style={buttons.secondary}
        >
          <Text style={buttons.secondaryText}>Use my voice note instead</Text>
          <ArrowRight size={16} color={C.ink} />
        </PressableScale>
      ) : null}
      {retry ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Record your order again"
          onPress={onRecord}
          style={s.quiet}
        >
          <Text style={s.quietText}>Record again instead</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  actions: { gap: 8 },
  quiet: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  quietText: { color: C.cyanDeep, fontSize: 12.5, fontWeight: '600' },
});

export default memo(RepairActions);
