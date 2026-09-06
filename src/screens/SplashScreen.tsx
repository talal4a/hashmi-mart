import React, { useCallback, useRef } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import SplashSequence from '../components/splash/SplashSequence';
import { SPLASH_BG } from '../components/splash/tokens';
import useSplashGate from '../hooks/useSplashGate';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

export default function SplashScreen() {
  const navigation = useNavigation<Nav>();
  const { ready, target } = useSplashGate();


  const targetRef = useRef(target);
  targetRef.current = target;
  const navigated = useRef(false);

  const go = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    navigation.reset({ index: 0, routes: [{ name: targetRef.current }] });
  }, [navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={SPLASH_BG} />
      <SplashSequence exit={ready} target={target} onExitComplete={go} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPLASH_BG,
  },
});
