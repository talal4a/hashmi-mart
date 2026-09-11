import './global.css';
import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { CartProvider } from './src/state/cart';
import { VoiceOrderProvider } from './src/state/voiceOrderSession';
import { configureGoogleSignIn } from './src/services/googleAuth';
import { preloadCarouselImages } from './src/utils/imageCache';

configureGoogleSignIn();


const __prevHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.warn('JS-GLOBAL-ERROR', isFatal, error?.message, error?.stack);
  __prevHandler?.(error, isFatal);
});

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  
  useEffect(() => {
    preloadCarouselImages();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <ErrorBoundary>
          {/* Above the navigator: Home fills the cart and Checkout spends it,
              and they are separate routes.

              The voice session is above it for a stricter reason. It owns a
              recording and the requests reading it, and it must outlive every
              sheet, modal and route that might show its progress — closing the
              microphone is not cancelling the order. */}
          <CartProvider>
            <VoiceOrderProvider>
              <RootNavigator />
            </VoiceOrderProvider>
          </CartProvider>
        </ErrorBoundary>
      </NavigationContainer>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
export default App;
