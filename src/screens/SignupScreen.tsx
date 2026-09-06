import React, { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, User as UserIcon } from 'lucide-react-native';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  PASSWORD_MIN,
  signupSchema,
  type SignupFormData,
} from '../validation/Schema';
import { createAccount } from '../services/emailAuth';
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
import AuthTermsNote from '../components/auth/AuthTermsNote';
import FormError from '../components/auth/FormError';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';
import ThemedButton from '../components/ThemedButton';
import { CARD_TOP_RADIUS, PILL_RADIUS } from '../components/auth/heroTokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;
export default function SignupScreen() {
  const navigation = useNavigation<Nav>();
  useAuthBack();
  const { goTo, goByProfile } = useAfterAuth();
  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const busy = submitting || googleBusy;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({ resolver: zodResolver(signupSchema) });

  const submit = handleSubmit(async data => {
    if (busy) return;
    setSubmitting(true);
    setFailure(null);
    try {
      await createAccount(data.name, data.email, data.password);
      goTo('CompleteProfile');
    } catch (error) {
      setFailure(
        authErrorMessage(error, "Couldn't create your account. Try again."),
      );
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
          title="Create Account"
          subtitle="Fill your information below, or register with your Google account."
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
          <AuthDivider label="Or sign up with" />
        </View>

        <AuthTextField
          control={control}
          name="name"
          label="Name"
          placeholder="Ex. John Doe"
          error={errors.name?.message}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
          icon={color => <UserIcon size={20} color={color} />}
        />

        <View className="mt-4">
          <AuthTextField
            control={control}
            name="email"
            label="Email"
            placeholder="example@gmail.com"
            error={errors.email?.message}
            inputRef={emailRef}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            icon={color => <Mail size={20} color={color} />}
          />
        </View>

        <View className="mt-4">
          <PasswordField
            control={control}
            name="password"
            label="Password"
            placeholder={`At least ${PASSWORD_MIN} characters`}
            error={errors.password?.message}
            inputRef={passwordRef}
            autoComplete="new-password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </View>

        <View className="mt-4">
          <AuthTermsNote />
        </View>

        <ThemedButton
          label={submitting ? 'Creating account…' : 'Sign Up'}
          variant="primary"
          radius={PILL_RADIUS}
          disabled={busy}
          onPress={submit}
          style={{ marginTop: 16 }}
        />

        <View className="mt-4">
          <AuthFooterLink
            prompt="Already have an account?"
            action="Sign In"
            onPress={() => navigation.replace('Login')}
          />
        </View>
      </AuthCard>
    </AuthScreen>
  );
}
