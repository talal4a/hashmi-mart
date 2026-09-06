import React from 'react';
import { Text, View } from 'react-native';

type Props = {
  name: string;
  email: string | null;
};

/**
 * Who the app thinks you are, shown back as text.
 *
 * Complete Profile stopped asking for a name once sign-up and Google both supply
 * one — but silently dropping the field would leave someone who tapped the wrong
 * Google account with no clue that they had. This is the field's replacement:
 * cheaper than an input, and it answers the only question the input was still
 * answering.
 *
 * There is no "edit" affordance on purpose. The name is changed where it was
 * given, and adding a second place to change it here means two writes that can
 * disagree about which one is current.
 */
export default function ProfileIdentity({ name, email }: Props) {
  return (
    <View className="rounded-xl bg-[#f0f9ff] px-4 py-3">
      <Text className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">
        Signed in as
      </Text>
      <Text
        className="mt-1 text-[15px] font-semibold text-[#0B2027]"
        numberOfLines={1}
      >
        {name}
      </Text>
      {email ? (
        <Text className="text-[12px] text-[#5E7679]" numberOfLines={1}>
          {email}
        </Text>
      ) : null}
    </View>
  );
}
