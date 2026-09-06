import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Mail } from 'lucide-react-native';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from '../validation/Schema';
import { auth } from '../config/firebase';
import { authErrorCode, authErrorMessage } from '../utils/authErrors';
import AuthCard from '../components/auth/AuthCard';
import AuthTextField from '../components/auth/AuthTextField';
import AuthScreen from '../components/auth/AuthScreen';
import AuthHero from '../components/auth/AuthHero';
import AuthFooterLink from '../components/auth/AuthFooterLink';
import { CARD_TOP_RADIUS, PILL_RADIUS } from '../components/auth/heroTokens';
import ResetLinkSent from '../components/auth/ResetLinkSent';
import ThemedButton from '../components/ThemedButton';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });
  const requestReset = async (email: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSentTo(email.trim());
    } catch (error) {
      if (authErrorCode(error) === 'auth/user-not-found') {
        setSentTo(email.trim());
      } else {
        Alert.alert("Couldn't send link", authErrorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      hero={
        <AuthHero
          title="Forgot Password?"
          subtitle="Enter your email and we'll send you a link to reset your password."
        />
      }
    >
      <AuthCard topRadius={CARD_TOP_RADIUS}>
        {sentTo ? (
          <ResetLinkSent
            email={sentTo}
            resending={busy}
            onResend={() => requestReset(sentTo)}
            onBackToLogin={() => navigation.popTo('Login')}
          />
        ) : (
          <>
            <AuthTextField
              control={control}
              name="email"
              label="Email"
              placeholder="example@gmail.com"
              error={errors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={handleSubmit(data => requestReset(data.email))}
              icon={color => <Mail size={20} color={color} />}
            />

            <ThemedButton
              label={busy ? 'Sending...' : 'Send reset link'}
              variant="primary"
              radius={PILL_RADIUS}
              disabled={busy}
              onPress={handleSubmit(data => requestReset(data.email))}
              style={{ marginTop: 20 }}
            />

            <View className="mt-4">
              <AuthFooterLink
                prompt="Remembered it?"
                action="Sign In"
                onPress={() => navigation.popTo('Login')}
              />
            </View>
          </>
        )}
      </AuthCard>
    </AuthScreen>
  );
}
