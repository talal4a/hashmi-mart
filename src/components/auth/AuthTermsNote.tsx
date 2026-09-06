import React from 'react';
import { Text } from 'react-native';

/**
 * The terms line above the Sign Up button.
 *
 * A statement rather than a checkbox, deliberately: a required checkbox is one
 * more thing that can silently block a signup, and consent-by-signup is what the
 * app already relies on. It sits where the reference puts its checkbox, so the
 * reading order is unchanged — you see the terms before the button, not after it.
 *
 * The two phrases are styled as links but are not yet pressable; there is no
 * route for either document. They are one component away from becoming so, and
 * looking tappable while doing nothing is better than the alternative of writing
 * a dead Pressable that swallows taps.
 */
export default function AuthTermsNote() {
  return (
    <Text className="text-center text-[12px] leading-5 text-[#9ca3af]">
      By signing up, you agree to our{' '}
      <Text className="font-semibold text-[#06b6d4]">Terms of Service</Text> and{' '}
      <Text className="font-semibold text-[#06b6d4]">Privacy Policy</Text>
    </Text>
  );
}
