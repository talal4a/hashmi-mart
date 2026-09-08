import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

const PHRASES = [
  'What do you need today?',
  'Say: 2 milk and one bread',
  'Order groceries with your voice',
  'Ask Hashmi AI anything',
];
const TICK = 70;

export default function VoiceOrderCopy() {
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const [copy, setCopy] = useState({ index: 0, text: PHRASES[0] });
  useEffect(() => {
    if (!focused) return;
    let elapsed = 0;
    let index = 0;
    let finished = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      if (timer || finished) return;
      timer = setInterval(() => {
        elapsed += TICK;
        const typing =
          index === 0 || reduced ? 0 : PHRASES[index].length * TICK;
        if (elapsed >= typing + 3000) {
          if (index === PHRASES.length - 1) {
            finished = true;
            stop();
            return;
          }
          index += 1;
          elapsed = 0;
        }
        const text =
          reduced || index === 0
            ? PHRASES[index]
            : PHRASES[index].slice(0, Math.max(1, Math.floor(elapsed / TICK)));
        setCopy(current =>
          current.text === text && current.index === index
            ? current
            : { index, text },
        );
      }, TICK);
    };
    setCopy({ index: 0, text: PHRASES[0] });
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', state =>
      state === 'active' ? start() : stop(),
    );
    return () => {
      stop();
      sub.remove();
    };
  }, [focused, reduced]);
  return (
    <View style={s.reserved} accessibilityLabel={PHRASES[copy.index]}>
      {/* Same text metrics reserve three lines, including system font scaling. */}
      <Text
        style={[s.text, { opacity: 0 }]}
        accessible={false}
        importantForAccessibility="no"
      >
        {'Order groceries\nwith your voice\ntoday'}
      </Text>
      <Animated.Text
        key={copy.index}
        entering={FadeIn.duration(reduced ? 240 : 180)}
        numberOfLines={3}
        style={[s.text, StyleSheet.absoluteFill]}
        accessible={false}
      >
        {copy.text}
      </Animated.Text>
    </View>
  );
}
const s = StyleSheet.create({
  reserved: { flex: 1, minHeight: 48 },
  text: { color: '#69818D', fontSize: 11, lineHeight: 16, letterSpacing: -0.1 },
});
