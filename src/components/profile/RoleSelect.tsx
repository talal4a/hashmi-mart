import React from 'react';
import { Keyboard, Text, View } from 'react-native';
import { Controller, type Control } from 'react-hook-form';
import {
  USER_ROLES,
  type CompleteProfileFormData,
  type UserRole,
} from '../../validation/Schema';
import SegmentedControl, {
  SEGMENT_LABEL,
  type Segment,
} from './SegmentedControl';

const LABELS: Record<UserRole, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
  rider: 'Rider',
};

const DESCRIPTIONS: Record<UserRole, string> = {
  customer: 'Shop for fresh groceries.',
  vendor: 'Sell groceries through Hashmi Mart.',
  rider: 'Deliver grocery orders.',
};

const SEGMENTS: readonly Segment<UserRole>[] = USER_ROLES.map(role => ({
  value: role,
  label: LABELS[role],
  a11yLabel: `${LABELS[role]}. ${DESCRIPTIONS[role]}`,
}));

export default function RoleSelect({
  control,
  disabled,
}: {
  control: Control<CompleteProfileFormData>;
  disabled: boolean;
}) {
  return (
    <Controller
      control={control}
      name="role"
      render={({
        field: { onChange, onBlur, value },
        fieldState: { error },
      }) => (
        <View>
          <Text className={`mb-1.5 ${SEGMENT_LABEL}`}>
            Your role (required)
          </Text>
          <SegmentedControl
            segments={SEGMENTS}
            value={value ?? null}
            height={48}
            disabled={disabled}
            onChange={role => {
              Keyboard.dismiss();
              onChange(role);
              onBlur();
            }}
            accessibilityLabel="Your role, required"
          />
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole={error ? 'alert' : undefined}
            className="mt-1.5 text-[12px] leading-5"
            style={{ color: error ? '#b91c1c' : '#5E7679' }}
          >
            {error?.message ??
              (value
                ? DESCRIPTIONS[value]
                : 'Choose how you’ll use Hashmi Mart.')}
          </Text>
        </View>
      )}
    />
  );
}
