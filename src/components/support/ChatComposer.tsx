import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowUp, Mic, Square } from 'lucide-react-native';
import Animated, {
  FadeInUp,
  FadeOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import PressableScale from '../ui/PressableScale';
import { support } from './supportTheme';

/**
 * Where the user writes, speaks, and stops the assistant.
 *
 * The send control is one button in three states rather than three buttons.
 * With an empty field it is a microphone; with text it is an arrow; while the
 * assistant is generating it is a Stop square (PRD section 7). A row that
 * changes what its controls *are* rather than which are enabled keeps the
 * thumb's target in one place, which matters more on a phone than the extra
 * affordance of showing everything at once.
 *
 * Section 8.2 asks the composer to "compress subtly" on send. That is the
 * `squeeze` below: a 2% scale dip and return, spring-settled. It is small
 * enough to be felt rather than watched, which is the difference between the
 * message leaving and the UI doing a trick.
 */

type Props = {
  onSend: (text: string) => void;
  onStartRecording: () => void;
  onStop: () => void;
  /** True while the assistant is thinking or streaming. */
  generating: boolean;
  disabled?: boolean;
};

export default function ChatComposer({
  onSend,
  onStartRecording,
  onStop,
  generating,
  disabled,
}: Props) {
  const [text, setText] = useState('');
  const squeeze = useSharedValue(0);
  const reduced = useReducedMotion();

  const hasText = text.trim().length > 0;

  const send = useCallback(() => {
    const value = text.trim();
    if (!value) return;
    setText('');
    if (!reduced) {
      squeeze.value = withSequence(
        withTiming(1, { duration: 90 }),
        withSpring(0, { damping: 16, stiffness: 260, mass: 0.6 }),
      );
    }
    onSend(value);
  }, [text, onSend, squeeze, reduced]);

  const press = () => {
    if (generating) onStop();
    else if (hasText) send();
    else {
      if (!reduced)
        squeeze.value = withSequence(
          withTiming(1, { duration: 90 }),
          withTiming(0, { duration: 160 }),
        );
      onStartRecording();
    }
  };

  const barStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: 1 - squeeze.value * 0.02 },
      { scaleY: 1 - squeeze.value * 0.04 },
    ],
  }));

  const label = generating
    ? 'Stop generating'
    : hasText
      ? 'Send message'
      : 'Record a voice message';

  return (
    <Animated.View
      entering={reduced ? undefined : FadeInUp.duration(180)}
      exiting={reduced ? undefined : FadeOutDown.duration(140)}
      collapsable={false}
    >
      <Animated.View style={[s.bar, barStyle]}>
        <TextInput
          value={text}
          onChangeText={setText}
          editable={!disabled}
          placeholder="Ask Hashmi anything..."
          placeholderTextColor={support.faint}
          multiline
          // Send-on-return would fight multiline entry, and a support question is
          // often two sentences. The button is the only send.
          blurOnSubmit={false}
          style={s.input}
          accessibilityLabel="Message Hashmi AI"
          // The field accepts Urdu and Punjabi script; direction follows content.
          textAlignVertical="center"
        />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={press}
          disabled={disabled}
          scaleTo={0.88}
          style={[
            s.action,
            generating ? s.actionStop : hasText ? s.actionSend : s.actionMic,
          ]}
        >
          {generating ? (
            <Square size={14} color="#FFFFFF" fill="#FFFFFF" />
          ) : hasText ? (
            <ArrowUp size={19} color="#FFFFFF" strokeWidth={2.6} />
          ) : (
            <Mic size={19} color="#FFFFFF" strokeWidth={2.2} />
          )}
        </PressableScale>
      </Animated.View>
    </Animated.View>
  );
}

/** The one-line hint under the composer. Kept here so spacing stays with it. */
export function ComposerNote({ children }: { children: string }) {
  return <Text style={s.note}>{children}</Text>;
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: support.aiBorder,
    shadowColor: '#345B73',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    // Android's TextInput carries built-in vertical padding that iOS does not;
    // matching them here is what stops the bar being 4px taller on one platform.
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 14.5,
    lineHeight: 20,
    color: support.ink,
    writingDirection: 'auto',
  },
  action: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSend: { backgroundColor: support.accent },
  actionMic: { backgroundColor: support.accent },
  actionStop: { backgroundColor: support.accent },
  note: {
    fontSize: 10.5,
    color: support.faint,
    textAlign: 'center',
    paddingTop: 6,
  },
});
