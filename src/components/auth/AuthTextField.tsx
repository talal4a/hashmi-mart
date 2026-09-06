import React, { useState, type ReactNode, type RefObject } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';

const ACTIVE = '#06b6d4';
const IDLE = '#9ca3af';

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  placeholder: string;
  /** Receives the current tint so the icon follows focus state. */
  icon: (color: string) => ReactNode;
  error?: string;
  /** Right-hand adornment, e.g. a password visibility toggle. */
  trailing?: ReactNode;
  /**
   * Shown above the row. The auth screens leave it off — a two-field form is
   * self-evident from its placeholders — but Complete Profile sets it, because
   * a placeholder disappears the moment you type and a profile form is exactly
   * where someone stops half-way and comes back to it.
   */
  label?: string;
  /**
   * Handed the underlying input so the previous field's return key can focus
   * this one. A prop rather than `forwardRef` because this component is generic
   * over the form's field names, and generics do not survive `forwardRef`
   * without a cast that throws the inference away.
   */
  inputRef?: RefObject<TextInput | null>;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur' | 'placeholder'>;

/**
 * The icon + filled-pill + focus-ring + error-line input row used across the
 * auth screens, wired to react-hook-form so screens stay declarative.
 */
export default function AuthTextField<T extends FieldValues>({
  control,
  name,
  placeholder,
  icon,
  error,
  trailing,
  label,
  inputRef,
  ...inputProps
}: Props<T>) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      {label ? (
        <Text className="mb-1.5 text-[13px] font-semibold text-[#5E7679]">
          {label}
        </Text>
      ) : null}
      <View
        className="flex-row items-center rounded-xl px-3 py-3"
        style={{
          backgroundColor: '#f0f9ff',
          borderWidth: focused ? 1.5 : 0,
          borderColor: focused ? ACTIVE : 'transparent',
        }}
      >
        {icon(focused ? ACTIVE : IDLE)}
        <Controller
          control={control}
          name={name}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              ref={inputRef}
              value={value as string}
              onChangeText={onChange}
              placeholder={placeholder}
              placeholderTextColor={IDLE}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                onBlur();
                setFocused(false);
              }}
              accessibilityLabel={label ?? placeholder}
              className="ml-3 flex-1 text-[16px] text-[#0B2027]"
              {...inputProps}
            />
          )}
        />
        {trailing}
      </View>
      {error ? (
        <Text className="mt-1 text-[12px] text-red-500">{error}</Text>
      ) : null}
    </View>
  );
}
