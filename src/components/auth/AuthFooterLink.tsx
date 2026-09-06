import React from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = {
  /** The plain half, e.g. "Already have an account?" */
  prompt: string;
  /** The tappable half, e.g. "Sign In". */
  action: string;
  onPress: () => void;
};

/**
 * The "Already have an account? Sign In" row under the primary button.
 *
 * Login and Sign Up are each other's only exit, and both had their own copy of
 * this row inside the header, above the form — where it competes with the title
 * for the first thing you read. Under the button is where the reference puts it,
 * and it is also the honest position: it is what you reach for after deciding
 * this is the wrong screen.
 *
 * The prompt is not inside the Pressable. A tap target that covers the whole
 * sentence looks like the sentence is a link.
 */
export default function AuthFooterLink({ prompt, action, onPress }: Props) {
  return (
    <View className="flex-row items-center justify-center">
      <Text className="text-[14px] text-[#5E7679]">{prompt} </Text>
      <Pressable onPress={onPress} hitSlop={10} accessibilityRole="link">
        <Text className="text-[14px] font-bold text-[#06b6d4]">{action}</Text>
      </Pressable>
    </View>
  );
}
