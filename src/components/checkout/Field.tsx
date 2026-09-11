import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ChevronDown } from 'lucide-react-native';
import PressableScale from '../ui/PressableScale';
import { grocery } from '../home/groceryTheme';

/**
 * One field of the delivery form.
 *
 * The default `TextInput` is a hairline on a transparent background, and on a
 * form of five of them the eye cannot tell where one ends and the next begins
 * — so people tap between them and miss. A field here is a filled white box
 * with its label above it, tall enough to hit without aiming, and it says which
 * one has the keyboard by lighting its border and laying a soft ring behind it.
 *
 * The error goes underneath rather than inside. Replacing the value with the
 * complaint is how a customer loses the phone number they just typed.
 */

const ERROR = '#D8543F';
const IDLE_BORDER = '#DCE8EF';

/** Comfortably tappable without making a five-field form a scrolling chore. */
const HEIGHT = 54;

type Props = {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string;
  placeholder?: string;
  icon?: ReactNode;
  /** Rendered inside the box, before the input — the fixed `+92`, say. */
  prefix?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  maxLength?: number;
  testID?: string;
};

export default function Field({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  icon,
  prefix,
  multiline,
  keyboardType,
  autoCapitalize = 'words',
  maxLength,
  testID,
}: Props) {
  const reduced = useReducedMotion();
  const focus = useSharedValue(0);
  const bad = useSharedValue(error ? 1 : 0);

  // In an effect, not in the render body. Writing a shared value while React
  // is rendering is a write that can happen twice, or be thrown away, or land
  // in the middle of someone else's frame — it is not a place to start an
  // animation from.
  useEffect(() => {
    bad.value = withTiming(error ? 1 : 0, { duration: reduced ? 0 : 160 });
  }, [error, reduced, bad]);

  const box = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      Math.max(focus.value, bad.value * 2),
      [0, 1, 2],
      [IDLE_BORDER, grocery.blue, ERROR],
    ),
  }));

  // Behind the box rather than a wider border, so focus does not move the
  // layout by a pixel and nudge the whole form.
  const ring = useAnimatedStyle(() => ({
    opacity: focus.value * 0.9,
    backgroundColor: error ? '#F7D9D2' : '#CBEBFA',
  }));

  const onFocus = useCallback(() => {
    focus.value = withTiming(1, { duration: reduced ? 0 : 170 });
  }, [focus, reduced]);
  const onBlur = useCallback(() => {
    focus.value = withTiming(0, { duration: reduced ? 0 : 200 });
  }, [focus, reduced]);

  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <View>
        <Animated.View pointerEvents="none" style={[s.ring, ring]} />
        <Animated.View style={[s.box, multiline && s.boxTall, box]}>
          {icon ? <View style={s.icon}>{icon}</View> : null}
          {prefix ? <Text style={s.prefix}>{prefix}</Text> : null}
          <TextInput
            testID={testID}
            value={value}
            onChangeText={onChangeText}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor="#A9BAC6"
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            maxLength={maxLength}
            multiline={multiline}
            accessibilityLabel={label}
            style={[s.input, multiline && s.inputTall]}
          />
        </Animated.View>
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

/**
 * The area, chosen rather than typed.
 *
 * Closed until tapped: twelve areas laid out permanently would be the tallest
 * thing on a screen whose subject is the order, and the choice is made once.
 */
export function AreaField({
  label,
  value,
  options,
  onSelect,
  error,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onSelect: (next: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${label}${value ? `, ${value}` : ', not chosen'}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(current => !current)}
        scaleTo={0.985}
      >
        <View style={[s.box, error ? s.boxBad : null]}>
          <Text
            numberOfLines={1}
            style={[s.input, s.select, !value && s.selectEmpty]}
          >
            {value || 'Choose your area'}
          </Text>
          <ChevronDown
            size={17}
            color={grocery.muted}
            strokeWidth={2.3}
            style={open ? s.chevronOpen : undefined}
          />
        </View>
      </PressableScale>

      {open ? (
        <View style={s.options}>
          {options.map(option => {
            const picked = option === value;
            return (
              <PressableScale
                key={option}
                accessibilityRole="button"
                accessibilityLabel={option}
                accessibilityState={{ selected: picked }}
                onPress={() => {
                  onSelect(option);
                  setOpen(false);
                }}
                scaleTo={0.97}
                style={[s.option, picked && s.optionPicked]}
              >
                <Text style={[s.optionText, picked && s.optionTextPicked]}>
                  {option}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: grocery.muted,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: HEIGHT,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: IDLE_BORDER,
    backgroundColor: grocery.white,
  },
  boxBad: { borderColor: ERROR },
  boxTall: { alignItems: 'flex-start', paddingVertical: 12, minHeight: 84 },
  ring: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 19,
  },
  icon: { width: 18, alignItems: 'center' },
  prefix: { fontSize: 15, fontWeight: '700', color: grocery.muted },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: grocery.ink,
    padding: 0,
  },
  inputTall: { minHeight: 58, textAlignVertical: 'top' },
  select: { paddingVertical: 17 },
  selectEmpty: { color: '#A9BAC6', fontWeight: '500' },
  chevronOpen: { transform: [{ rotate: '180deg' }] },

  options: {
    marginTop: 2,
    padding: 6,
    gap: 2,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: IDLE_BORDER,
    backgroundColor: grocery.white,
  },
  option: { paddingHorizontal: 12, paddingVertical: 11, borderRadius: 11 },
  optionPicked: { backgroundColor: grocery.pale },
  optionText: { fontSize: 14, fontWeight: '600', color: grocery.ink },
  optionTextPicked: { fontWeight: '800', color: grocery.blue },

  error: { fontSize: 11.5, fontWeight: '700', color: ERROR },
});
