import React, { useState, type RefObject } from 'react';
import { Pressable, type TextInput, type TextInputProps } from 'react-native';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
import AuthTextField from './AuthTextField';

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  placeholder?: string;
  error?: string;
  label?: string;
  inputRef?: RefObject<TextInput | null>;
} & Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'onBlur' | 'placeholder' | 'secureTextEntry'
>;

/**
 * A password row: the shared field plus the visibility toggle.
 *
 * Both auth screens hand-rolled this, which is why only one of them had a
 * toggle at all. It exists because sign-up no longer asks for a confirmation —
 * being able to see what you typed is what replaces typing it twice, so the
 * toggle is load-bearing rather than a nicety.
 */
export default function PasswordField<T extends FieldValues>({
  control,
  name,
  placeholder = 'Password',
  error,
  label,
  inputRef,
  ...inputProps
}: Props<T>) {
  const [visible, setVisible] = useState(false);

  return (
    <AuthTextField
      control={control}
      name={name}
      placeholder={placeholder}
      error={error}
      label={label}
      inputRef={inputRef}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      icon={color => <Lock size={20} color={color} />}
      trailing={
        <Pressable
          onPress={() => setVisible(v => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? (
            <EyeOff size={20} color="#9ca3af" />
          ) : (
            <Eye size={20} color="#9ca3af" />
          )}
        </Pressable>
      }
      {...inputProps}
    />
  );
}
