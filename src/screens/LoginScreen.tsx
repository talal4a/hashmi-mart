import React, { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react-native';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { loginSchema, type LoginFormData } from '../validation/Schema';
import { signIn } from '../services/emailAuth';
import { googleErrorMessage, signInWithGoogle } from '../services/googleAuth';
import { authErrorMessage } from '../utils/authErrors';
import useAfterAuth from '../hooks/useAfterAuth';
import useAuthBack from '../hooks/useAuthBack';
import AuthScreen from '../components/auth/AuthScreen';
import AuthHero from '../components/auth/AuthHero';
import AuthCard from '../components/auth/AuthCard';
import AuthTextField from '../components/auth/AuthTextField';
import PasswordField from '../components/auth/PasswordField';
import AuthDivider from '../components/auth/AuthDivider';
import AuthFooterLink from '../components/auth/AuthFooterLink';
import FormError from '../components/auth/FormError';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';
import ThemedButton from '../components/ThemedButton';
import { CARD_TOP_RADIUS, PILL_RADIUS } from '../components/auth/heroTokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  useAuthBack();
  const { goByProfile } = useAfterAuth();
  const passwordRef = useRef<TextInput | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const busy = submitting || googleBusy;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const submit = handleSubmit(async data => {
    if (busy) return;
    setSubmitting(true);
    setFailure(null);
    try {
      const credential = await signIn(data.email, data.password);
      await goByProfile(credential.user.uid);
    } catch (error) {
      setFailure(authErrorMessage(error, 'Login failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  });

  const withGoogle = async () => {
    if (busy) return;
    setGoogleBusy(true);
    setFailure(null);
    try {
      const credential = await signInWithGoogle();
      if (credential) await goByProfile(credential.user.uid);
    } catch (error) {
      console.warn('Google sign-in failed:', error);
      setFailure(googleErrorMessage(error));
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <AuthScreen
      hero={
        <AuthHero
          title="Welcome Back"
          subtitle="Sign in to pick up where you left off, or continue with Google."
        />
      }
    >
      <AuthCard topRadius={CARD_TOP_RADIUS}>
        {failure ? (
          <View className="mb-5">
            <FormError message={failure} />
          </View>
        ) : null}

        <GoogleAuthButton
          onPress={withGoogle}
          loading={googleBusy}
          disabled={submitting}
        />

        <View className="my-4">
          <AuthDivider label="Or sign in with" />
        </View>

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
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          icon={color => <Mail size={20} color={color} />}
        />

        <View className="mt-4">
          <PasswordField
            control={control}
            name="password"
            label="Password"
            placeholder="Your password"
            error={errors.password?.message}
            inputRef={passwordRef}
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </View>

        <Pressable
          onPress={() => navigation.navigate('ForgotPassword')}
          hitSlop={10}
          accessibilityRole="link"
          className="mt-3 items-end"
        >
          <Text className="text-[13px] font-semibold text-[#06b6d4]">
            Forgot password?
          </Text>
        </Pressable>

        <ThemedButton
          label={submitting ? 'Logging in…' : 'Login'}
          variant="primary"
          radius={PILL_RADIUS}
          disabled={busy}
          onPress={submit}
          style={{ marginTop: 20 }}
        />

        <View className="mt-4">
          <AuthFooterLink
            prompt="New to Hashmi Mart?"
            action="Create Account"
            onPress={() => navigation.replace('Signup')}
          />
        </View>
      </AuthCard>
    </AuthScreen>
  );
}
