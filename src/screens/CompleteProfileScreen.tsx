import React, { useCallback, useEffect } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { signOutGoogle } from '../services/googleAuth';
import useStoredProfile from '../hooks/useStoredProfile';
import AuthScreen, { AUTH_BG } from '../components/auth/AuthScreen';
import AuthCard from '../components/auth/AuthCard';
import AuthHeader from '../components/auth/AuthHeader';
import ProfileForm from '../components/profile/ProfileForm';
type Nav = NativeStackNavigationProp<RootStackParamList>;
export default function CompleteProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { status, user, profile, offline } = useStoredProfile();
  useEffect(() => {
    const handler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );
    return () => handler.remove();
  }, []);
  const signOutNow = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
    void signOutGoogle().catch(error =>
      console.warn('Sign-out failed after leaving Complete Profile:', error),
    );
  }, [navigation]);
  const ready = status === 'ready' && user !== null;
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: AUTH_BG }} />;
  }

  return (
    <AuthScreen>
      <AuthCard>
        <AuthHeader title="Complete Your Profile">
          <Text className="text-center text-[14px] leading-5 text-[#5E7679]">
            Choose how you’ll use Hashmi Mart and add your contact details.
          </Text>
        </AuthHeader>

        <View className="mt-6">
          <ProfileForm
            uid={user.uid}
            displayName={user.displayName}
            email={user.email}
            photoURL={user.photoURL}
            profile={profile}
            offline={offline}
          />
        </View>
      </AuthCard>

      <Pressable
        onPress={signOutNow}
        hitSlop={8}
        accessibilityRole="button"
        className="mt-5 items-center"
      >
        <Text className="text-[13px] text-[#5E7679]">
          Not you?{' '}
          <Text className="font-semibold text-[#06b6d4]">Sign out</Text>
        </Text>
      </Pressable>
    </AuthScreen>
  );
}
