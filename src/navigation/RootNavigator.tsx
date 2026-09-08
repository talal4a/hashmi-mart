import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import SupportScreen from '../screens/SupportScreen';
import CheckoutScreen from '../screens/CheckoutScreen';

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Home: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  CompleteProfile: undefined;
  Support: undefined;
  /**
   * `source` and `transcript` describe where the basket came from, not what is
   * in it — the cart itself lives in `CartProvider`, so quantities are never
   * copied into navigation params where an edit made here could not get back.
   */
  Checkout:
    | {
        source?: 'voice' | 'browse';
        transcript?: string | null;
        /** Spoken items we do not stock, so checkout can say so. */
        missed?: string[];
      }
    | undefined;
};

const slideFromRight: NativeStackNavigationOptions = {
  animation: 'slide_from_right',
  animationDuration: 300,
  contentStyle: { backgroundColor: '#ecfeff' },
};

const fadeThrough: NativeStackNavigationOptions = {
  animation: 'fade',
  animationDuration: 250,
  contentStyle: { backgroundColor: '#ecfeff' },
};

const slideFromBottom: NativeStackNavigationOptions = {
  animation: 'slide_from_bottom',
  animationDuration: 350,
  contentStyle: { backgroundColor: '#ecfeff' },
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator id="root" screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
        options={fadeThrough}
      />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={fadeThrough}
      />
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ ...fadeThrough, animation: 'none' }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ ...slideFromRight, gestureEnabled: true }}
      />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{ ...slideFromRight, gestureEnabled: true }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={slideFromRight}
      />
      <Stack.Screen
        name="CompleteProfile"
        component={CompleteProfileScreen}
        options={{ ...fadeThrough, animation: 'none' }}
      />
      {/* Support rises from the bottom, the way a chat sheet should, and stays
          swipe-dismissable — it is somewhere you drop into and back out of,
          not a place in the app's hierarchy. */}
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{ ...slideFromBottom, gestureEnabled: true }}
      />
      {/* Checkout slides in from the side: it is a step forward in a flow, and
          going back to the cart has to feel like going back. */}
      <Stack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ ...slideFromRight, gestureEnabled: true }}
      />
    </Stack.Navigator>
  );
}
