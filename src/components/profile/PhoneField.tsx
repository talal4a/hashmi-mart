import React, { useState, type RefObject } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import { Phone } from 'lucide-react-native';
import { DIAL_CODE, groupDigits } from '../../utils/phone';

const ACTIVE = '#06b6d4';
const IDLE = '#9ca3af';

/** 12 digits at most, grouped as `300 123 4567` — two spaces on top. */
const MAX_LENGTH = 14;

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  error?: string;
  label?: string;
  inputRef?: RefObject<TextInput | null>;
} & Pick<
  TextInputProps,
  'returnKeyType' | 'onSubmitEditing' | 'submitBehavior'
>;

/**
 * A mobile number, with the country fixed rather than chosen.
 *
 * The app delivers in one country, so a country-code picker would be a list with
 * one useful row in it and 200 ways to make the number undialable. `+92` is
 * printed as part of the field instead: it cannot be deleted, and the number
 * stored is always `+92` plus whatever digits the user typed (see utils/phone).
 *
 * Digits are regrouped on every keystroke rather than validated on blur, so the
 * shape of the number tells the user how many digits are left. Everything that
 * is not a digit is dropped on the way in — pasting "0300-123 4567" from a
 * contact card is the normal case, not an edge one.
 */
export default function PhoneField<T extends FieldValues>({
  control,
  name,
  error,
  label = 'Mobile number',
  inputRef,
  ...inputProps
}: Props<T>) {
  const [focused, setFocused] = useState(false);
  const tint = focused ? ACTIVE : IDLE;

  return (
    <View>
      <Text className="mb-1.5 text-[13px] font-semibold text-[#5E7679]">
        {label}
      </Text>
      <View
        className="flex-row items-center rounded-xl px-3 py-3"
        style={{
          backgroundColor: '#f0f9ff',
          borderWidth: focused ? 1.5 : 0,
          borderColor: focused ? ACTIVE : 'transparent',
        }}
      >
        <Phone size={20} color={tint} />
        <Text className="ml-3 text-[16px] font-semibold text-[#0B2027]">
          {DIAL_CODE}
        </Text>
        <View
          style={{
            width: 1,
            height: 20,
            marginHorizontal: 10,
            backgroundColor: '#d1e9f2',
          }}
        />
        <Controller
          control={control}
          name={name}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              ref={inputRef}
              value={value as string}
              onChangeText={text => onChange(groupDigits(text))}
              placeholder="300 123 4567"
              placeholderTextColor={IDLE}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              maxLength={MAX_LENGTH}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                onBlur();
                setFocused(false);
              }}
              accessibilityLabel={`${label}, country code ${DIAL_CODE}`}
              className="flex-1 text-[16px] tracking-wide text-[#0B2027]"
              {...inputProps}
            />
          )}
        />
      </View>
      {error ? (
        <Text className="mt-1 text-[12px] text-red-500">{error}</Text>
      ) : null}
    </View>
  );
}
