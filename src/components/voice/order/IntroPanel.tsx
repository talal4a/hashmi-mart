import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Mic, Quote } from 'lucide-react-native';
import PressableScale from '../../ui/PressableScale';
import { VoiceOrb } from '../VoiceOrderVisuals';
import StepRail from './StepRail';
import { EXAMPLE_PHRASES } from './copy';
import { C, buttons, text } from './theme';

/**
 * The first screen of a voice order: ready, not listening.
 *
 * The sheet used to open with the microphone already live, which is fast for
 * someone who has done it before and ambush for everyone else — the first
 * seconds of the recording were reliably a person working out that it had
 * started. Opening on a held breath costs one tap and buys the two things that
 * decide whether the order works: what to say, and that it is a list rather
 * than a conversation.
 */

function IntroPanel({ onStart }: { onStart: () => void }) {
  return (
    <View style={s.panel}>
      <StepRail current="speak" />
      <View style={s.heading}>
        <Text style={text.title}>Say your list</Text>
        <Text style={text.body}>
          Speak in Urdu, Punjabi or English. Say each item and how many you
          want.
        </Text>
      </View>
      {/*
        Tappable for anyone who reads the screen and goes straight for the big
        round microphone, and invisible to screen readers on purpose: it does
        exactly what the button below does, and two controls announcing the
        same sentence is worse than one.
      */}
      <PressableScale
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onPress={onStart}
        scaleTo={0.97}
        style={s.orbTap}
      >
        <VoiceOrb active={false} />
      </PressableScale>
      <View style={s.examples}>
        <View style={s.examplesHead}>
          <Quote size={11} color={C.muted} />
          <Text style={text.label}>TRY SAYING</Text>
        </View>
        {EXAMPLE_PHRASES.map(phrase => (
          <Text key={phrase} style={s.phrase}>
            “{phrase}”
          </Text>
        ))}
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Start recording your order"
        onPress={onStart}
        style={buttons.primary}
      >
        <Mic size={17} color={C.paper} />
        <Text style={buttons.primaryText}>Start recording</Text>
      </PressableScale>
      <Text style={s.footnote}>
        You get 2 minutes. We send your voice to the shop as well, so nothing is
        missed.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { gap: 16, paddingTop: 20, paddingBottom: 4 },
  heading: { gap: 7 },
  orbTap: { alignSelf: 'center' },
  examples: {
    backgroundColor: C.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    gap: 8,
  },
  examplesHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phrase: {
    color: C.ink,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    writingDirection: 'auto',
  },
  footnote: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
});

export default memo(IntroPanel);
