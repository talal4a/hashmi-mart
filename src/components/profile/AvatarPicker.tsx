import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import AvatarChip from './AvatarChip';
import ProfileAvatar from './ProfileAvatar';
import SegmentedControl, {
  SEGMENT_LABEL,
  type Segment,
} from './SegmentedControl';
import AvatarArt from './avatars/AvatarArt';
import { AVATAR_GROUPS, findAvatar, type AvatarGroup } from './avatars/catalog';
import { SWITCH_MS } from '../auth/motion';
import { useIdleReady } from '../../hooks/useIdleReady';

const CHIP = 52;

/** The switch only filters what is already on screen, so it sits below the
 *  42dp the form's own inputs use — and on the label's row, not a row of its
 *  own, which is where the saving actually comes from. */
const FILTER_H = 34;
const FILTER_W = 132;

const GROUP_SEGMENTS: readonly Segment<AvatarGroup>[] = AVATAR_GROUPS.map(
  group => ({ value: group.group, label: group.label }),
);

/** Hoisted: an inline object here is a new style identity on every render, and
 *  the rail re-renders on every tap in the card. */
const RAIL_CONTENT = {
  gap: 10,
  paddingRight: 4,
  paddingTop: 2,
  alignItems: 'center',
} as const;

const FILTER_BOX = { width: FILTER_W } as const;
const RUN = { flexDirection: 'row', gap: 10, alignItems: 'center' } as const;

/**
 * The inactive half of the rail: out of layout *and* incapable of drawing.
 *
 * `display: 'none'` is the part Yoga needs, and on its own it is what lets the rail
 * measure five chips instead of nine. The rest is belt and braces against the bug
 * this is fixing — two runs of characters visible at once. RN on Android does not
 * clip a subview to its parent's bounds unless asked, and each hidden chip holds an
 * `<Svg>`, a native canvas that draws itself rather than being laid out like a box;
 * a zero-sized parent is no guarantee its ink stays inside. Absolute positioning
 * takes the run out of the flow whatever `display` is honoured as, and `opacity: 0`
 * settles it outright: nothing at zero alpha reaches the screen.
 */
const HIDDEN = {
  display: 'none',
  position: 'absolute',
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  opacity: 0,
  overflow: 'hidden',
} as const;

/**
 * What the rail can actually offer, in one sentence.
 *
 * Split out because there are four true combinations of it and a nested ternary in
 * the middle of the JSX read as three. The no-photo line names the tap-again
 * gesture: without an own-photo chip, tapping the chosen character is the only way
 * back to no character at all, and a gesture nothing announces is not a feature.
 *
 * The pencil is named rather than described, because it is the only pencil on the
 * screen and "tap the pencil" survives the sheet behind it changing. What the line
 * has to carry is that a photo is an option at all: a badge announces "editable"
 * without announcing "from your gallery".
 */
function hintFor(canUpload: boolean, own: string | null): string {
  if (own) {
    return canUpload
      ? `Tap the pencil to change your photo, keep your ${own}, or pick a character.`
      : `Keep your ${own}, or pick a character.`;
  }
  return canUpload
    ? 'Tap the pencil to add your own photo, or pick a character.'
    : 'Pick a character — tap it again to remove it.';
}

type Props = {
  /** The chosen preset id, or null for "use my photo / initials". */
  value: string | null;
  onChange: (id: string | null) => void;
  /** The user's own uploaded photo, if they have one. */
  avatarUrl?: string | null;
  photoURL?: string | null;
  name: string;
  email?: string | null;
  /** False when this build has no photo picker, which changes the hint line. */
  canUpload: boolean;
};

/**
 * Pick a character, or keep what the account already has.
 *
 * The leading chip is the account's own picture, and it appears only when there is
 * one. It used to be unconditional, on the reasoning that `null` is a real answer
 * and needs somewhere to live — but with no photo and no Google photo it drew the
 * initials fallback, and for an account whose name has not been typed yet, the grey
 * placeholder glyph: an empty circle offered as a choice, sitting next to eight
 * characters. That is the "empty avatar" in the bug report, and the fix is not to
 * style it better but to not offer it. Tapping the chosen character clears it
 * instead, which is the way back to `null` when the chip is absent, and the hint
 * line says so.
 *
 * The two avatar groups are a switch rather than two captioned runs in one rail.
 * The
 * captions cost a 15dp line inside the rail and the single rail meant nine chips
 * fighting over 272dp, so the fourth option of the first group was already
 * clipped and the second group was entirely off-screen. Filtering leaves five
 * chips and puts the switch on the label's row, which is what makes the switch
 * nearly free: the row is as tall as the 34dp switch rather than the 15dp label,
 * so it spends 19dp to save the 15dp caption and win back four chips of width.
 *
 * The rail still scrolls: with an own-photo chip, a hairline and four 63dp
 * character chips it needs 366dp against 272dp, so the last one is deliberately
 * clipped rather than hidden, which is the only honest cue that it is reachable.
 * Fitting five in 272dp would need 38dp artwork, and at 38dp the eight characters
 * stop being distinguishable from each other.
 *
 * Switching group never changes the selection — the hero above keeps showing
 * whatever is chosen even when its chip is in the other half — so the switch is
 * a filter, not an input, and it opens on the group the stored avatar is in.
 *
 * Both groups stay mounted and the switch only flips which one is HIDDEN. Chips
 * keyed by preset id made a tap into a teardown: four chips destroyed and four
 * built, each one 100 elements — 95 svg nodes of avatar, a two-node tick, three
 * views — so ~400 released and ~400 created inside the one commit that is supposed
 * to be answering a finger, which is why the switch felt slow whatever the thumb's
 * duration was. Hidden is not the same as absent: Yoga drops `display: 'none'`
 * children from layout, so the rail still measures as five chips and still scrolls
 * to the same place, while the native views survive to be shown again.
 *
 * The half nobody has asked for yet is built in the dead time after the screen
 * settles rather than with it (see useIdleReady), so opening the screen costs
 * what it always did. A tap that beats the idle callback still works — that
 * group just mounts then instead, once.
 *
 * Uploading is deliberately not a sixth chip. It would have cost the rail another
 * 73dp of scroll and pushed the characters mostly out of view at rest, on a card
 * that was just shortened to clear the fold; the pencil badge on the hero (see
 * AvatarHero) does the same job inside space that is already spent. What the rail
 * still owes it is the hint line, because a badge announces "editable" without
 * announcing "from your gallery" — so the line names the pencil when this build
 * can reach a photo, and says nothing about it when it cannot.
 */
export default function AvatarPicker({
  value,
  onChange,
  avatarUrl,
  photoURL,
  name,
  email,
  canUpload,
}: Props) {
  // Only a real picture earns the leading chip; initials and the placeholder glyph
  // are not choices, they are what is left when nothing was chosen.
  const own = avatarUrl ? 'photo' : photoURL ? 'Google photo' : null;
  const rail = useRef<ScrollView | null>(null);

  // Read once, on purpose: re-deriving this from `value` would yank the rail to
  // the other group the moment someone taps a chip.
  const [group, setGroup] = useState<AvatarGroup>(
    () => findAvatar(value)?.group ?? 'boys',
  );

  // Both halves of the rail live in the tree; this only decides when the second
  // one gets built. Never true on first paint, so the screen opens at the cost
  // it always had.
  const ready = useIdleReady();

  // A rail left mid-scroll would show the new group already half past its first
  // option. Not animated: the chips underneath have already changed.
  useEffect(() => {
    rail.current?.scrollTo({ x: 0, animated: false });
  }, [group]);

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className={SEGMENT_LABEL}>Profile picture</Text>
        <View style={FILTER_BOX}>
          <SegmentedControl
            segments={GROUP_SEGMENTS}
            value={group}
            onChange={setGroup}
            height={FILTER_H}
            duration={SWITCH_MS}
            accessibilityLabel="Character group"
          />
        </View>
      </View>

      <Text className="mt-1 text-[12px] leading-4 text-[#9ca3af]">
        {hintFor(canUpload, own)}
      </Text>

      <ScrollView
        ref={rail}
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-2"
        contentContainerStyle={RAIL_CONTENT}
      >
        {own ? (
          <>
            <AvatarChip
              selected={value === null}
              onPress={() => onChange(null)}
              label={`Use my ${own}`}
              size={CHIP}
            >
              <ProfileAvatar
                preset={null}
                avatarUrl={avatarUrl}
                photoURL={photoURL}
                name={name}
                email={email}
                size={CHIP}
              />
            </AvatarChip>

            <View className="h-10 w-px bg-[#e5e7eb]" />
          </>
        ) : null}

        {AVATAR_GROUPS.map(candidate => {
          const on = candidate.group === group;
          if (!on && !ready) return null;
          // Out of layout is not out of the accessibility tree: a hidden chip is
          // still a radio TalkBack can land on unless it is told otherwise.
          return (
            <View
              key={candidate.group}
              style={on ? RUN : HIDDEN}
              pointerEvents={on ? 'auto' : 'none'}
              accessibilityElementsHidden={!on}
              importantForAccessibility={on ? 'auto' : 'no-hide-descendants'}
            >
              {candidate.presets.map(preset => {
                const chosen = value === preset.id;
                return (
                  <AvatarChip
                    key={preset.id}
                    selected={chosen}
                    // Tapping the chosen one clears it. With no own-photo chip on
                    // the rail this is the only route back to no character, and it
                    // is the obvious gesture to try either way.
                    onPress={() => onChange(chosen ? null : preset.id)}
                    label={`${preset.label}, ${candidate.label.toLowerCase()} avatar`}
                    size={CHIP}
                  >
                    <AvatarArt preset={preset} size={CHIP} />
                  </AvatarChip>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
