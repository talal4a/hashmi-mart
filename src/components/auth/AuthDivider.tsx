import React from 'react';
import { Text, View } from 'react-native';

/**
 * The "OR" rule between the form and the social button. Three copies of these
 * eleven lines existed; the label is a prop because the sheet may want "or"
 * lower-case later without touching the other two.
 */
export default function AuthDivider({ label = 'OR' }: { label?: string }) {
  return (
    <View className="flex-row items-center">
      <View className="h-px flex-1 bg-gray-200" />
      <Text className="mx-4 text-sm text-gray-400">{label}</Text>
      <View className="h-px flex-1 bg-gray-200" />
    </View>
  );
}
