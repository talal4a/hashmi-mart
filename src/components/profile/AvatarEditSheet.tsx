import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Images, Trash2 } from 'lucide-react-native';
import { PICKER_UNAVAILABLE } from '../../services/photoPicker';
import { STATE_MS } from '../auth/motion';

/** Small on purpose: the fade is doing most of the work, this only gives it a
 *  direction. 18dp over STATE_MS reads as the panel settling rather than flying. */
const RISE = 18;

const ICON = 40;
const INK = '#0B2027';
const DANGER = '#dc2626';

export type AvatarEditAction = 'camera' | 'library' | 'remove';

type RowProps = {
  icon: React.ReactNode;
  label: string;
  /** Why the row cannot be used, when it cannot. */
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/**
 * One action. Internal because it is not a row of anything else — the shape is
 * this sheet's, and a shared list-row component would have to grow a `danger`
 * variant and an icon well for its only other caller.
 *
 * A disabled row is dimmed rather than removed, because the sheet is also where
 * "why not" gets explained; a row that vanishes takes its own reason with it.
 */
function Row({ icon, label, hint, danger, disabled, onPress }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: danger ? '#fee2e2' : '#e0f7fb' }}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={{ opacity: disabled ? 0.4 : 1, paddingVertical: 11 }}
      className="flex-row items-center"
    >
      <View
        style={{
          width: ICON,
          height: ICON,
          borderRadius: ICON / 2,
          backgroundColor: danger ? '#fef2f2' : '#e0f7fb',
        }}
        className="items-center justify-center"
      >
        {icon}
      </View>

      <View className="ml-3 flex-1">
        <Text
          style={{ color: danger ? DANGER : INK }}
          className="text-[15px] font-semibold"
        >
          {label}
        </Text>
        {hint ? (
          <Text className="mt-0.5 text-[12px] leading-4 text-[#9ca3af]">
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: AvatarEditAction) => void;
  /** False when this build has no picker: both photo rows are dead. */
  canUpload: boolean;
  /** Only an *uploaded* photo can be removed; a Google one is a fallback. */
  canRemove: boolean;
};

/**
 * What the pencil opens: take a photo, choose one, or remove the one there is.
 *
 * A plain `Modal` rather than the `@gorhom/bottom-sheet` used on Onboarding, and
 * that is a structural constraint rather than a preference. Complete Profile's
 * form renders inside `AuthScreen`'s ScrollView, so a gorhom sheet mounted from
 * here would be a child of a scrollable — positioned against scroll content
 * instead of the window, and competing with the ScrollView for the same
 * vertical pan. `Modal` opens its own native window above everything, which is
 * what makes it safe to mount from deep inside a form.
 *
 * The rise is RN's own `Animated`, not Reanimated, for the reason the rest of
 * the profile furniture is: a Reanimated worklet can still be mid-write when
 * Fabric deletes a view, which surfaces as the SurfaceMountingManager warning.
 * This panel's whole life is a mount and an unmount. See ProfileAvatar.
 *
 * Closing before acting is deliberate. The native picker is another activity,
 * and launching it from under a modal that is still up leaves this panel behind
 * the camera and waiting when the user comes back.
 *
 * There is no Cancel row: the backdrop and hardware back both close, and on
 * Android a Cancel row is a fourth thing to read for something two gestures
 * already do. The caller must not open this with nothing actionable in it —
 * `canUpload` false and `canRemove` false is a sheet of dead rows, and the
 * reason belongs under the picture instead (see ProfileForm).
 */
export default function AvatarEditSheet({
  visible,
  onClose,
  onSelect,
  canUpload,
  canRemove,
}: Props) {
  const insets = useSafeAreaInsets();
  const rise = useRef(new Animated.Value(RISE)).current;

  useEffect(() => {
    if (!visible) {
      // Reset on the way out, not on the way in: the panel unmounts with the
      // modal, so the next open starts from wherever this was left.
      rise.setValue(RISE);
      return;
    }
    const run = Animated.timing(rise, {
      toValue: 0,
      duration: STATE_MS,
      // RN's Easing, not AUTH_EASE — same curve, and AUTH_EASE is a Reanimated
      // factory that throws from inside the animation loop here. See auth/motion.
      easing: Easing.bezier(0.32, 0.42, 0.68, 1),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [visible, rise]);

  const choose = (action: AvatarEditAction) => {
    onClose();
    onSelect(action);
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(11,32,39,0.45)' },
          ]}
        />

        <Animated.View
          style={{
            transform: [{ translateY: rise }],
            backgroundColor: '#ffffff',
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            paddingBottom: insets.bottom + 12,
            shadowColor: '#000000',
            shadowOpacity: 0.12,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: -6 },
            elevation: 16,
          }}
          className="px-5 pt-3"
        >
          <View className="items-center">
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#d1d5db',
              }}
            />
          </View>

          <Text className="mt-4 text-[16px] font-bold text-[#0B2027]">
            Profile picture
          </Text>

          {canUpload ? null : (
            <Text className="mt-1 text-[12px] leading-4 text-[#9ca3af]">
              {PICKER_UNAVAILABLE}
            </Text>
          )}

          <View className="mt-3">
            <Row
              icon={<Camera size={19} color="#0e7490" strokeWidth={2.2} />}
              label="Take a photo"
              disabled={!canUpload}
              onPress={() => choose('camera')}
            />
            <Row
              icon={<Images size={19} color="#0e7490" strokeWidth={2.2} />}
              label="Choose from gallery"
              disabled={!canUpload}
              onPress={() => choose('library')}
            />
            {canRemove ? (
              <Row
                icon={<Trash2 size={19} color={DANGER} strokeWidth={2.2} />}
                label="Remove photo"
                danger
                onPress={() => choose('remove')}
              />
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
