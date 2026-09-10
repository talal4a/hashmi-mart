import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { C } from './theme';

/**
 * Where the customer is in the three things that happen.
 *
 * Voice ordering asks people to hand over a task and wait, and waiting without
 * knowing what is being waited on is where "is it broken?" comes from. The rail
 * is not decoration: these are genuinely sequential, one of them is happening
 * right now, and the last one names where the order is going to end up — which
 * is the part a first-time user cannot guess.
 */

export type VoiceStep = 'speak' | 'listen' | 'cart';

const STEPS: { id: VoiceStep; label: string }[] = [
  { id: 'speak', label: 'Say it' },
  { id: 'listen', label: 'We listen' },
  { id: 'cart', label: 'Your cart' },
];

function StepRail({ current }: { current: VoiceStep }) {
  const at = STEPS.findIndex(step => step.id === current);
  return (
    <View
      style={s.rail}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${at + 1} of 3: ${STEPS[at]?.label}`}
    >
      {STEPS.map((step, index) => {
        const done = index < at;
        const active = index === at;
        return (
          <View key={step.id} style={s.segment}>
            {index > 0 ? (
              <View style={[s.link, index <= at && s.linkDone]} />
            ) : null}
            <View style={[s.dot, done && s.dotDone, active && s.dotActive]}>
              {done ? (
                <Check size={9} color={C.paper} strokeWidth={3.5} />
              ) : null}
            </View>
            <Text
              style={[s.label, (done || active) && s.labelOn]}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
  },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { width: 16, height: 1.5, borderRadius: 1, backgroundColor: C.line },
  linkDone: { backgroundColor: '#A9DFF2' },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: C.cyan },
  dotActive: { backgroundColor: C.paper, borderWidth: 4, borderColor: C.cyan },
  label: { fontSize: 10.5, color: C.muted, fontWeight: '600' },
  labelOn: { color: C.ink, fontWeight: '700' },
});

export default memo(StepRail);
