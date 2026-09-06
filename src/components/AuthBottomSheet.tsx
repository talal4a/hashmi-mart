import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Mail, Smartphone } from 'lucide-react-native';
import ThemedButton from './ThemedButton';
import GoogleAuthButton from './auth/GoogleAuthButton';
import AuthDivider from './auth/AuthDivider';
import FormError from './auth/FormError';
import { googleErrorMessage, signInWithGoogle } from '../services/googleAuth';
import useAfterAuth from '../hooks/useAfterAuth';

/**
 * The auth options sheet on Onboarding.
 *
 * Replaces @gorhom/bottom-sheet. That library's backdrop is an always-mounted
 * full-screen GestureDetector whose "am I closed?" state is set by a racy
 * useAnimatedReaction — when it loses the race the closed sheet's invisible
 * backdrop eats every tap on the screen ("Get Started does nothing"), and its
 * snap animation is Reanimated-driven, which this project has repeatedly seen
 * silently fail under Fabric + frame starvation. Both failure modes are gone
 * here by construction:
 *
 *  - The backdrop is a plain Pressable whose pointerEvents follow React state
 *    (never mounted, never touchable while closed).
 *  - The slide is RN's built-in Animated with useNativeDriver, torn down with
 *    the view, no JSI worklets involved.
 *  - Dragging the sheet down dismisses it (flick or >30% pull), via a
 *    PanResponder that only claims clearly downward gestures.
 *
 * The public API is the same shape as before (snapToIndex/close) so callers do
 * not change.
 */
export type AuthBottomSheetHandle = {
  snapToIndex: (index: number) => void;
  close: () => void;
};

type AuthBottomSheetProps = {
  onGooglePress?: () => void;
  onPhonePress?: () => void;
  onManualSignUpPress?: () => void;
  onSignInPress?: () => void;
};

const SHEET_MS = 320;
const SHEET_EASE = Easing.bezier(0.22, 1, 0.36, 1);

const AuthBottomSheet = forwardRef<
  AuthBottomSheetHandle,
  AuthBottomSheetProps
>(({ onGooglePress, onPhonePress, onManualSignUpPress, onSignInPress }, ref) => {
  const { goByProfile } = useAfterAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /** Height of the sheet's content, measured once. */
  const sheetHeight = useRef(0);
  /** Progress 0 (closed) → 1 (open). */
  const progress = useRef(new Animated.Value(0)).current;
  /** Mirrors `progress` in React state so the backdrop's pointerEvents follow
   *  the truth instead of a UI-thread race. */
  const [open, setOpen] = useState(false);
  /** Drag offset in px while the finger pulls the sheet down. */
  const dragY = useRef(new Animated.Value(0)).current;
  /** Last known progress / drag values, refined from native on grab. */
  const progressRef = useRef(0);
  const dragRef = useRef(0);
  /** Cumulative gesture dy when the sheet claimed the responder. */
  const grantDy = useRef(0);
  /** Whether an open/close/settle animation is running. */
  const animatingRef = useRef(false);
  /** True while grabbed mid-animation, until native values have synced. */
  const syncingRef = useRef(false);

  const openSheet = useCallback(() => {
    progress.setValue(0);
    dragY.setValue(0);
    progressRef.current = 1;
    dragRef.current = 0;
    setOpen(true);
    animatingRef.current = true;
    Animated.timing(progress, {
      toValue: 1,
      duration: SHEET_MS,
      easing: SHEET_EASE,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        animatingRef.current = false;
      }
    });
  }, [progress, dragY]);

  const closeSheet = useCallback(() => {
    animatingRef.current = true;
    progressRef.current = 0;
    dragRef.current = 0;
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 0,
        duration: SHEET_MS,
        easing: SHEET_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(dragY, {
        toValue: 0,
        duration: SHEET_MS,
        easing: SHEET_EASE,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        animatingRef.current = false;
        setOpen(false);
      }
    });
  }, [progress, dragY]);

  /** Return the sheet to its open resting place from wherever it was left. */
  const springBack = useCallback(() => {
    animatingRef.current = true;
    progressRef.current = 1;
    dragRef.current = 0;
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: SHEET_MS,
        easing: SHEET_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(dragY, {
        toValue: 0,
        duration: SHEET_MS,
        easing: SHEET_EASE,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        animatingRef.current = false;
      }
    });
  }, [progress, dragY]);

  useImperativeHandle(
    ref,
    () => ({
      snapToIndex: (index: number) => {
        if (index >= 0) {
          openSheet();
        } else {
          closeSheet();
        }
      },
      close: closeSheet,
    }),
    [openSheet, closeSheet],
  );

  /**
   * Drag-to-dismiss. The sheet claims the responder only once a gesture is
   * clearly a downward drag, so taps on the buttons inside are never eaten.
   * A flick or a pull past ~30% of the sheet's height closes it; anything
   * less springs back open.
   */
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 10 && g.dy > 1.2 * Math.abs(g.dx),
      onPanResponderGrant: (_, g) => {
        grantDy.current = g.dy;
        if (animatingRef.current) {
          // Grabbed mid-animation: the JS-side refs are stale, so stop the
          // animations and fetch the real values from the native side before
          // letting the drag take over.
          animatingRef.current = false;
          syncingRef.current = true;
          let pending = 2;
          const synced = () => {
            pending -= 1;
            if (pending === 0) {
              syncingRef.current = false;
            }
          };
          progress.stopAnimation(value => {
            progressRef.current = value;
            synced();
          });
          dragY.stopAnimation(value => {
            dragRef.current = value;
            synced();
          });
        }
      },
      onPanResponderMove: (_, g) => {
        if (syncingRef.current) {
          return;
        }
        const sheetH = sheetHeight.current || 420;
        const dragged = dragRef.current + (g.dy - grantDy.current);
        dragY.setValue(Math.min(Math.max(0, dragged), sheetH));
      },
      onPanResponderRelease: (_, g) => {
        if (syncingRef.current) {
          springBack();
          return;
        }
        const sheetH = sheetHeight.current || 420;
        const dragged = Math.max(0, dragRef.current + (g.dy - grantDy.current));
        const pulled = sheetH * (1 - progressRef.current) + dragged;
        const flick = g.vy > 0.5 && g.dy > 24;
        if (flick || pulled > sheetH * 0.3) {
          closeSheet();
        } else {
          springBack();
        }
      },
      onPanResponderTerminate: () => {
        syncingRef.current = false;
        springBack();
      },
    }),
  ).current;

  /** Translate the sheet up by its measured height, plus any live drag. */
  const sheetStyle = {
    transform: [
      {
        translateY: Animated.add(
          progress.interpolate({
            inputRange: [0, 1],
            outputRange: [sheetHeight.current || 420, 0],
            extrapolate: 'clamp',
          }),
          dragY,
        ),
      },
    ],
  };
  const backdropStyle = {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }),
  };

  /**
   * Signs in without leaving Onboarding, then routes on the profile rather
   * than straight Home — a returning account that never finished its profile
   * has to land on Complete Profile from here too, or the gate is only half
   * enforced.
   */
  const handleGooglePress = async () => {
    if (onGooglePress) {
      onGooglePress();
      return;
    }
    setGoogleLoading(true);
    setFailure(null);
    try {
      const credential = await signInWithGoogle();
      if (!credential) return;

      closeSheet();
      await goByProfile(credential.user.uid);
    } catch (error) {
      console.warn('Google sign-in failed:', error);
      setFailure(googleErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  };

  // Nothing is mounted while closed. The previous implementations — the
  // gorhom backdrop and a translated-off-screen sheet — both left a full-width
  // touch target covering the Start button, which is the "Get Started does
  // nothing" bug. Unmounted is the only state that provably cannot intercept.
  if (!open) {
    return null;
  }

  return (
    <>
      {/* Backdrop: touchable ONLY while open. */}
      <Pressable
        onPress={closeSheet}
        accessibilityLabel="Bottom sheet backdrop"
        style={StyleSheet.absoluteFill}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdropStyle]}
        />
      </Pressable>

      {/* The sheet itself: drag down anywhere to dismiss. */}
      <Animated.View
        style={[
          styles.sheet,
          sheetStyle,
          {
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            backgroundColor: '#ffffff',
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: -6 },
            elevation: 16,
          },
        ]}
        {...panResponder.panHandlers}
        onLayout={e => {
          sheetHeight.current = e.nativeEvent.layout.height;
        }}
      >
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Get started</Text>
          <Text style={styles.subtitle}>
            Sign in or create an account to continue shopping.
          </Text>

          {failure ? (
            <View style={{ marginTop: 16 }}>
              <FormError message={failure} />
            </View>
          ) : null}

          <GoogleAuthButton
            onPress={handleGooglePress}
            loading={googleLoading}
            style={{ marginTop: 24 }}
          />
          <ThemedButton
            label="Sign up with Email"
            variant="outline"
            onPress={onManualSignUpPress}
            icon={
              <View style={{ marginRight: 10 }}>
                <Mail size={20} color="#06b6d4" strokeWidth={2} />
              </View>
            }
            style={{ marginTop: 10 }}
          />

          <View style={styles.dividerWrap}>
            <AuthDivider />
          </View>
          <ThemedButton
            label="Continue with Phone"
            variant="primary"
            onPress={onPhonePress}
            icon={
              <View style={{ marginRight: 10 }}>
                <Smartphone size={20} color="white" strokeWidth={2} />
              </View>
            }
          />

          <Pressable onPress={onSignInPress} style={styles.signInRow}>
            <Text style={styles.signInText}>
              Already have an account?{' '}
              <Text style={styles.signInLink}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </>
  );
});

AuthBottomSheet.displayName = 'AuthBottomSheet';

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 2,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 34,
  },
  title: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: '#6b7280',
  },
  dividerWrap: {
    marginVertical: 20,
  },
  signInRow: {
    marginTop: 18,
    alignItems: 'center',
  },
  signInText: {
    fontSize: 14,
    color: '#6b7280',
  },
  signInLink: {
    fontWeight: '600',
    color: '#06b6d4',
  },
});

export default AuthBottomSheet;