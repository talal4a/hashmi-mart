import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Check,
  Clock,
  Ear,
  MicOff,
  RotateCcw,
  Settings,
  Store,
  WifiOff,
} from 'lucide-react-native';
import type { VoiceIcon, VoiceOutcome, VoiceTone } from './copy';
import { C, text } from './theme';

/**
 * What happened, in the largest type on the sheet.
 *
 * The mark above it is coloured by tone rather than by severity: an item we do
 * not stock is amber and a match is green, but neither is red, because nothing
 * here is the customer's fault and a red badge over a grocery list reads like
 * a failed payment.
 */

const ICONS: Record<VoiceIcon, typeof Check> = {
  check: Check,
  ear: Ear,
  store: Store,
  'mic-off': MicOff,
  'wifi-off': WifiOff,
  clock: Clock,
  redo: RotateCcw,
  settings: Settings,
};

const MARK: Record<VoiceTone, { background: string; colour: string }> = {
  found: { background: C.goodPale, colour: C.good },
  ask: { background: '#E1F3FA', colour: C.cyanDeep },
  shelf: { background: C.shelfPale, colour: C.shelf },
  repair: { background: '#DFF3FB', colour: C.cyanDeep },
  blocked: { background: '#E9EEF1', colour: C.ink },
};

function OutcomeHeader({ outcome }: { outcome: VoiceOutcome }) {
  const Glyph = ICONS[outcome.icon];
  const mark = MARK[outcome.tone];
  return (
    <View style={s.header}>
      <View style={[s.mark, { backgroundColor: mark.background }]}>
        <Glyph size={23} color={mark.colour} strokeWidth={2.2} />
      </View>
      <Text style={text.title}>{outcome.title}</Text>
      <Text style={text.body}>{outcome.body}</Text>
      {outcome.example ? (
        <View style={s.example}>
          <Text style={s.exampleLabel}>Say it like this</Text>
          <Text style={s.exampleText}>“{outcome.example}”</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  header: { gap: 9, alignItems: 'center' },
  mark: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  example: {
    alignSelf: 'stretch',
    marginTop: 2,
    borderRadius: 16,
    backgroundColor: C.pale,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  exampleLabel: { color: C.cyanDeep, fontSize: 10.5, fontWeight: '700' },
  exampleText: {
    color: C.ink,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    writingDirection: 'auto',
  },
});

export default memo(OutcomeHeader);
