import React from 'react';
import { Text, View } from 'react-native';
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import { GENDERS, type Gender } from '../../validation/Schema';
import SegmentedControl, {
  SEGMENT_LABEL,
  type Segment,
} from './SegmentedControl';

/**
 * Labels in the order GENDERS declares them, so a new option added to the schema
 * shows up here as a missing key rather than as a silently absent choice.
 *
 * `short` is what fits a third of the row; `full` is what a screen reader says.
 * "Prefer not to say" is ~120dp at this weight against ~90dp of segment, so the
 * visible text had to give — but the meaning is a decline, not a third gender,
 * and "Other" would have quietly changed the answer to make it fit.
 */
const LABELS: Record<Gender, { short: string; full: string }> = {
  male: { short: 'Male', full: 'Male' },
  female: { short: 'Female', full: 'Female' },
  unspecified: { short: 'Not saying', full: 'Prefer not to say' },
};

const SEGMENTS: readonly Segment<Gender>[] = GENDERS.map(gender => ({
  value: gender,
  label: LABELS[gender].short,
  a11yLabel: LABELS[gender].full,
}));

/**
 * Gender, optional and never in the way.
 *
 * One segmented row rather than the three wrapping pills this used to be. The
 * pills were the right idea — the whole set visible, nothing to open, and
 * declining sitting beside the other two answers instead of hiding as the
 * absence of a choice — but "Prefer not to say" pushed them onto a second 42dp
 * row. This recovers 55dp of card: 50dp of that second row and its gap, and 5dp
 * from the tighter label spacing a single row can afford.
 *
 * That 55dp does not move the mobile field, which sits above this and was always
 * on screen; it is spent below, where it brings the address field and the Save
 * button 55dp closer to the fold instead of 55dp further from it. On a form whose
 * last two rows are the ones people actually have to reach, that is the useful
 * end to save it at.
 *
 * A dropdown would have saved another 10dp and cost a tap, an overlay, and the
 * options being visible at all. Nothing is selected until the user selects it,
 * and the form submits happily either way.
 */
export default function GenderSelect<T extends FieldValues>({
  control,
  name,
  label = 'Gender (optional)',
}: {
  control: Control<T>;
  name: Path<T>;
  label?: string;
}) {
  return (
    <View>
      <Text className={`mb-1.5 ${SEGMENT_LABEL}`}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }) => (
          <SegmentedControl
            segments={SEGMENTS}
            value={(value as Gender | undefined) ?? null}
            onChange={onChange}
            accessibilityLabel={label}
          />
        )}
      />
    </View>
  );
}
