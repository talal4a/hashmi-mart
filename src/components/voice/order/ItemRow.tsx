import { useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LayoutRectangle } from 'react-native';
import { Check, Minus, Plus, TriangleAlert } from 'lucide-react-native';
import PressableScale from '../../ui/PressableScale';
import ProduceArt from '../../home/ProduceArt';
import { freshPicks } from '../../../data/groceryHome';
import type { CatalogMatch } from '../../../services/voiceCatalog';
import { C } from './theme';

/**
 * One line of the heard order.
 *
 * A row has to admit which of three things it is, because they are not equally
 * good news: a certain match gets a stepper, a guess gets a question and the
 * word we actually heard, and something we do not stock gets told plainly
 * without being dressed up as an error the customer could fix by speaking
 * again.
 */

const products = new Map(freshPicks.map(product => [product.id, product]));

/**
 * A stocked product we are not sure the customer meant — a fuzzy spelling, or
 * a model guess the transcript did not back up. It enters the cart only through
 * `confirmMatch`; until then it is not addable.
 */
export const isGuess = (match: CatalogMatch) =>
  Boolean(match.productId) && match.confidence !== 'high';

export const hasPendingGuess = (matches: CatalogMatch[]) =>
  matches.some(isGuess);

export default function ItemRow({
  match,
  onSetQuantity,
  onMeasure,
  onConfirm,
}: {
  match: CatalogMatch;
  onSetQuantity: (n: number) => void;
  onMeasure: (id: string, frame: LayoutRectangle) => void;
  /** Accepts a guessed product; only rendered as a control while it is one. */
  onConfirm: () => void;
}) {
  const node = useRef<View>(null);
  const product = match.productId ? products.get(match.productId) : undefined;
  const guess = Boolean(product) && isGuess(match);
  const measure = useCallback(() => {
    if (!match.productId) return;
    node.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0)
        onMeasure(match.productId!, { x, y, width, height });
    });
  }, [match.productId, onMeasure]);

  return (
    <View style={[s.item, guess && s.itemGuess, !product && s.itemShelf]}>
      <View ref={node} collapsable={false} onLayout={measure} style={s.art}>
        {product ? (
          <ProduceArt index={product.art} size={48} radius={14} />
        ) : (
          <TriangleAlert color={C.shelf} size={20} />
        )}
      </View>
      <View style={s.body}>
        <Text style={s.name}>{match.productName || match.query}</Text>
        <Text style={[s.meta, !product && s.metaShelf]}>
          {guess
            ? `We heard “${match.query}”`
            : product
              ? product.meta
              : match.unstocked
                ? `We do not sell ${match.unstocked} yet`
                : 'We did not catch this. It is in your voice note.'}
        </Text>
      </View>
      {guess ? (
        // Outlined, not filled: the sheet's one filled control is the primary
        // action below, and a row should not compete with it.
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Yes, add ${match.productName}`}
          onPress={onConfirm}
          style={s.accept}
        >
          <Check size={13} color={C.cyan} strokeWidth={2.5} />
          <Text style={s.acceptText}>Add</Text>
        </PressableScale>
      ) : product ? (
        <View style={s.stepper}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Less ${match.productName}`}
            onPress={() => onSetQuantity(Math.max(0, match.quantity - 1))}
            style={s.step}
          >
            <Minus size={13} color={C.ink} />
          </PressableScale>
          <Text style={s.quantity}>{match.quantity}</Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`More ${match.productName}`}
            onPress={() => onSetQuantity(match.quantity + 1)}
            style={s.step}
          >
            <Plus size={13} color={C.ink} />
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.paper,
    borderRadius: 19,
    padding: 10,
    borderWidth: 1,
    borderColor: C.line,
  },
  itemGuess: { borderColor: '#A9DFF2', backgroundColor: '#F7FDFF' },
  itemShelf: { backgroundColor: C.shelfPale, borderColor: '#F0DFBF' },
  art: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF8FC',
  },
  body: { flex: 1, gap: 4 },
  name: { color: C.ink, fontSize: 13, fontWeight: '700' },
  meta: { color: C.muted, fontSize: 10, lineHeight: 15 },
  metaShelf: { color: C.shelf },
  // Same 44dp height as the stepper it stands in for, so accepting a guess
  // swaps the control without the row changing size.
  accept: {
    height: 44,
    minWidth: 72,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  acceptText: { color: C.cyan, fontSize: 12, fontWeight: '700' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F0F7FA',
  },
  step: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    color: C.ink,
    fontSize: 12,
    minWidth: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
