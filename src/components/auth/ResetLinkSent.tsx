import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MailCheck } from 'lucide-react-native';
import ThemedButton from '../ThemedButton';
import { PILL_RADIUS } from './heroTokens';

type Props = {
  email: string;
  resending: boolean;
  onResend: () => void;
  onBackToLogin: () => void;
};

/**
 * Confirmation state for the forgot-password flow. Deliberately does not claim
 * the address is registered — see ForgotPasswordScreen for why.
 */
export default function ResetLinkSent({
  email,
  resending,
  onResend,
  onBackToLogin,
}: Props) {
  return (
    <View className="items-center">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-[#06b6d4]/10">
        <MailCheck size={30} color="#06b6d4" strokeWidth={2} />
      </View>

      <Text className="mt-5 text-center text-[22px] font-bold leading-tight text-[#0B2027]">
        Check your email
      </Text>

      <Text className="mt-2 text-center text-[15px] leading-6 text-[#5E7679]">
        If an account exists for{'\n'}
        <Text className="font-semibold text-[#0B2027]">{email}</Text>
        {'\n'}we've sent a link to reset your password.
      </Text>

      <Text className="mt-4 text-center text-[13px] leading-5 text-[#9ca3af]">
        The link opens a secure page where you can set a new password. Check
        your spam folder if it hasn't arrived in a minute.
      </Text>

      <View className="mt-6 w-full">
        <ThemedButton
          label={resending ? 'Sending...' : 'Resend link'}
          variant="outline"
          radius={PILL_RADIUS}
          disabled={resending}
          onPress={onResend}
        />
      </View>

      <Pressable onPress={onBackToLogin} className="mt-5">
        <Text className="text-[15px] font-semibold text-[#06b6d4]">
          Back to login
        </Text>
      </Pressable>
    </View>
  );
}
