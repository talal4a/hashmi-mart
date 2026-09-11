import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import {
  ArrowRight,
  Mic,
  MapPin,
  Minus,
  NotebookPen,
  Phone,
  Plus,
  Trash2,
  TriangleAlert,
  User,
} from 'lucide-react-native';
import PressableScale from '../ui/PressableScale';
import ProduceArt from '../home/ProduceArt';
import { grocery } from '../home/groceryTheme';
import VoiceNotePlayer, { type PlayerTone } from '../voice/VoiceNotePlayer';
import Field, { AreaField } from './Field';
import OrderSummary from './OrderSummary';
import { DELIVERY_AREAS } from '../../data/deliveryAreas';
import { freshPicks } from '../../data/groceryHome';
import { money, type OrderTotals } from '../../services/pricing';
import type { CartLine } from '../../state/cart';
import type { DeliveryErrors, DeliveryForm } from '../../validation/delivery';

/**
 * Step one: everything that can still be changed.
 *
 * The split between this screen and Preview is the whole point of the three
 * steps. Here every number has a control beside it and every detail is a field
 * you can put a cursor in; there, nothing is editable and the only decision is
 * whether to pay. A single screen that does both is a screen where the button
 * that removes an item sits a thumb's width from the button that charges you.
 *
 * Nothing here is asked for twice. The name, phone and address are already on
 * the account, so they arrive filled in and looking exactly like fields the
 * customer typed — no "auto-filled" chips, no read-only state to unlock first.
 * A prefilled field the user has to tap "edit" to change is a field they have
 * to fill in anyway, with a step added.
 */

/** On a pale card, unlike the chat's white-on-colour bubble. */
const PLAYER_TONE: PlayerTone = {
  control: grocery.blue,
  icon: grocery.white,
  waveOn: grocery.blue,
  waveOff: '#B9DEF0',
  text: grocery.muted,
  status: grocery.muted,
};

type Props = {
  form: DeliveryForm;
  errors: DeliveryErrors;
  onChange: <K extends keyof DeliveryForm>(
    key: K,
    value: DeliveryForm[K],
  ) => void;
  lines: CartLine[];
  totals: OrderTotals;
  onAdjust: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  /** Where the order came from, so the voice trimmings only show for voice. */
  fromVoice: boolean;
  recording: { uri: string; durationMs: number } | null;
  playing: boolean;
  onPlay: () => void;
  /** Heard but not ordered: an empty shelf and a word we could not place. */
  outOfStock: string[];
  unclear: string[];
  onContinue: () => void;
  bottomInset: number;
};

export default function DetailsStep({
  form,
  errors,
  onChange,
  lines,
  totals,
  onAdjust,
  onRemove,
  fromVoice,
  recording,
  playing,
  onPlay,
  outOfStock,
  unclear,
  onContinue,
  bottomInset,
}: Props) {
  const reduced = useReducedMotion();
  const enter = reduced ? undefined : FadeInDown.duration(240);

  // Everything we sell that is not already in the basket. An "add another"
  // row that offers what is already in the order is a row that looks broken
  // when tapping it appears to do nothing.
  const spare = useMemo(
    () => freshPicks.filter(item => !lines.some(line => line.id === item.id)),
    [lines],
  );

  return (
    <View style={s.fill}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.body}
      >
        <Animated.View entering={enter} style={s.intro}>
          <Text style={s.title}>Review your details</Text>
          <Text style={s.subtitle}>
            We have filled in what we already know. Check or edit anything
            before continuing.
          </Text>
        </Animated.View>

        <Section title="Delivery details" note="Saved details">
          <Field
            label="Full name"
            value={form.name}
            onChangeText={next => onChange('name', next)}
            error={errors.name}
            placeholder="Your full name"
            icon={<User size={16} color={grocery.muted} strokeWidth={2.2} />}
            testID="checkout-name"
          />
          <Field
            label="Phone number"
            value={form.phone}
            onChangeText={next => onChange('phone', next)}
            error={errors.phone}
            placeholder="300 123 4567"
            prefix="+92"
            keyboardType="phone-pad"
            autoCapitalize="none"
            maxLength={14}
            icon={<Phone size={16} color={grocery.muted} strokeWidth={2.2} />}
            testID="checkout-phone"
          />
          <AreaField
            label="Area"
            value={form.area}
            options={DELIVERY_AREAS}
            onSelect={next => onChange('area', next)}
            error={errors.area}
          />
          <Field
            label="Delivery address"
            value={form.address}
            onChangeText={next => onChange('address', next)}
            error={errors.address}
            placeholder="House number, street"
            multiline
            icon={<MapPin size={16} color={grocery.muted} strokeWidth={2.2} />}
            testID="checkout-address"
          />
          <Field
            label="Order instructions"
            value={form.instructions}
            onChangeText={next => onChange('instructions', next)}
            error={errors.instructions}
            placeholder="Call before delivery, ring the top bell…"
            multiline
            maxLength={160}
            autoCapitalize="sentences"
            icon={
              <NotebookPen size={16} color={grocery.muted} strokeWidth={2.2} />
            }
            testID="checkout-instructions"
          />
        </Section>

        <Section
          title={fromVoice ? 'Your voice order' : 'Your items'}
          badge={fromVoice ? 'Voice detected' : undefined}
        >
          {/* The recording, kept small. It is evidence, not the subject: a
              player the size of a card makes the order look like an attachment
              to a voice note rather than a list of groceries. */}
          {recording ? (
            <View style={s.note}>
              <Mic size={13} color={grocery.blue} strokeWidth={2.5} />
              <View style={s.noteBody}>
                <VoiceNotePlayer
                  uri={recording.uri}
                  durationMs={recording.durationMs}
                  tone={PLAYER_TONE}
                  label="your voice order"
                  active={playing}
                  onActivate={onPlay}
                />
              </View>
            </View>
          ) : null}

          {lines.map((line, index) => (
            <ItemCard
              key={line.id}
              line={line}
              index={index}
              onAdjust={onAdjust}
              onRemove={onRemove}
            />
          ))}

          {/* Two different pieces of news, said separately. An empty shelf is
              ours to fix and nothing the customer can repeat their way out of;
              a word we could not place is worth another try. */}
          {outOfStock.length || unclear.length ? (
            <View style={s.missed}>
              <TriangleAlert size={14} color="#D8853F" strokeWidth={2.4} />
              <View style={s.missedBody}>
                <Text style={s.missedTitle}>Not in this order</Text>
                {outOfStock.length ? (
                  <Text style={s.missedText}>
                    We do not sell {phrase(outOfStock)} yet.
                  </Text>
                ) : null}
                {unclear.length ? (
                  <Text style={s.missedText}>
                    We could not make out “{unclear.join('”, “')}”.
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {spare.length ? (
            <View style={s.addBlock}>
              <Text style={s.addLabel}>Add another product</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.addRow}
              >
                {spare.map(item => (
                  <PressableScale
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${item.name} to this order`}
                    onPress={() => onAdjust(item.id, 1)}
                    scaleTo={0.94}
                    style={s.addChip}
                  >
                    <ProduceArt index={item.art} size={38} radius={11} />
                    <View style={s.addChipText}>
                      <Text style={s.addChipName} numberOfLines={1}>
                        {item.name.split(' ')[0]}
                      </Text>
                      <Text style={s.addChipPrice}>{money(item.price)}</Text>
                    </View>
                    <Plus size={14} color={grocery.blue} strokeWidth={3} />
                  </PressableScale>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </Section>

        <Section title="Order summary">
          <OrderSummary totals={totals} />
        </Section>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: bottomInset + 14 }]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Continue to preview"
          onPress={onContinue}
          scaleTo={0.97}
          style={s.cta}
        >
          <Text style={s.ctaText}>Continue to preview</Text>
          <ArrowRight size={17} color={grocery.white} strokeWidth={2.6} />
        </PressableScale>
      </View>
    </View>
  );
}

/**
 * One line of the order, with its controls.
 *
 * The stepper is here rather than only in the cart sheet because an order
 * assembled from Punjabi speech is the most likely one to carry a wrong
 * quantity, and sending the customer back to Home to fix it is how a wrong
 * quantity gets bought instead.
 */
function ItemCard({
  line,
  index,
  onAdjust,
  onRemove,
}: {
  line: CartLine;
  index: number;
  onAdjust: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(index * 45).duration(220)}
      style={s.item}
    >
      <ProduceArt index={line.art} size={56} radius={15} />

      <View style={s.itemText}>
        <Text style={s.itemName} numberOfLines={1}>
          {line.name}
        </Text>
        <Text style={s.itemMeta} numberOfLines={1}>
          {line.meta}
        </Text>
        <Text style={s.itemEach}>{money(line.price)} each</Text>
      </View>

      <View style={s.itemRight}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Remove ${line.name} from this order`}
          onPress={() => onRemove(line.id)}
          scaleTo={0.88}
          hitSlop={8}
          style={s.bin}
        >
          <Trash2 size={14} color="#A9BAC6" strokeWidth={2.2} />
        </PressableScale>

        <View style={s.stepper}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`One less ${line.name}`}
            onPress={() => onAdjust(line.id, -1)}
            scaleTo={0.88}
            hitSlop={6}
            style={s.step}
          >
            <Minus size={13} color={grocery.blue} strokeWidth={3} />
          </PressableScale>
          <Text style={s.qty}>{line.quantity}</Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`One more ${line.name}`}
            onPress={() => onAdjust(line.id, 1)}
            scaleTo={0.88}
            hitSlop={6}
            style={s.step}
          >
            <Plus size={13} color={grocery.blue} strokeWidth={3} />
          </PressableScale>
        </View>

        <Text style={s.itemTotal}>{money(line.total)}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * A titled block with room around it.
 *
 * Sections rather than one long card: a form, a basket and a bill are three
 * different kinds of thing, and stacking them inside one border makes the
 * customer parse where each one ends.
 */
function Section({
  title,
  note,
  badge,
  children,
}: {
  title: string;
  note?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        {badge ? (
          <View style={s.badge}>
            <Mic size={10} color={grocery.blue} strokeWidth={2.8} />
            <Text style={s.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {note ? <Text style={s.sectionNote}>{note}</Text> : null}
      </View>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

/** "eggs", "eggs and rice", "eggs, rice and salt". */
function phrase(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 24, gap: 22 },
  intro: { gap: 5 },
  title: { fontSize: 21, fontWeight: '900', color: grocery.ink },
  subtitle: { fontSize: 13.5, lineHeight: 19, color: grocery.muted },

  section: { gap: 11 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flex: 1, fontSize: 14.5, fontWeight: '900', color: grocery.ink },
  sectionNote: { fontSize: 10.5, fontWeight: '700', color: '#9BB0BE' },
  sectionBody: { gap: 11 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: grocery.pale,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: grocery.blue,
  },

  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 15,
    backgroundColor: grocery.pale,
  },
  noteBody: { flex: 1 },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3EEF4',
    backgroundColor: grocery.white,
  },
  itemText: { flex: 1, gap: 2 },
  itemName: { fontSize: 14.5, fontWeight: '800', color: grocery.ink },
  itemMeta: { fontSize: 11.5, color: grocery.muted },
  itemEach: { fontSize: 11.5, fontWeight: '700', color: '#9BB0BE' },
  itemRight: { alignItems: 'flex-end', gap: 7 },
  bin: {
    position: 'absolute',
    top: -6,
    right: -2,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 18,
    padding: 3,
    borderRadius: 14,
    backgroundColor: grocery.pale,
  },
  step: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: grocery.white,
  },
  qty: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '900',
    color: grocery.ink,
    fontVariant: ['tabular-nums'],
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '900',
    color: grocery.ink,
    fontVariant: ['tabular-nums'],
  },

  missed: {
    flexDirection: 'row',
    gap: 9,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFF4E4',
  },
  missedBody: { flex: 1, gap: 2 },
  missedTitle: { fontSize: 12.5, fontWeight: '900', color: '#8A6634' },
  missedText: { fontSize: 12, lineHeight: 17, color: '#6B5844' },

  addBlock: { gap: 8, paddingTop: 2 },
  addLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: grocery.muted,
  },
  addRow: { gap: 8, paddingRight: 4, paddingVertical: 2 },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDEDF5',
    backgroundColor: grocery.white,
  },
  addChipText: { gap: 1 },
  addChipName: { fontSize: 12.5, fontWeight: '800', color: grocery.ink },
  addChipPrice: { fontSize: 11, fontWeight: '700', color: grocery.muted },

  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: grocery.canvas,
    borderTopWidth: 1,
    borderTopColor: '#E3EEF4',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 54,
    borderRadius: 27,
    backgroundColor: grocery.blue,
  },
  ctaText: { fontSize: 15.5, fontWeight: '900', color: grocery.white },
});
