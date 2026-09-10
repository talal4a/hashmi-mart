import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { freshPicks } from '../data/groceryHome';

/**
 * The cart, hoisted out of Home.
 *
 * It used to be `useState` inside `HomeScreen`, which was fine while the only
 * things that read it were Home's own bottom bar and its cart sheet. Checkout
 * is a route, so a cart that lives in one screen's state is a cart that cannot
 * be checked out: pushing the quantities through navigation params would send a
 * copy, and edits made on the way to paying would be edits to the copy.
 *
 * So it lives above the navigator instead, and both screens read the same
 * object. Still in memory only — nothing here persists across a cold start,
 * which is the next thing this file should grow and deliberately not today's
 * change.
 */

export type CartLine = {
  id: string;
  name: string;
  meta: string;
  price: number;
  /** Index into the produce illustrations, so a line can draw itself. */
  art: number;
  quantity: number;
  total: number;
};

type CartValue = {
  quantities: Record<string, number>;
  /** Priced, named rows for everything with a quantity above zero. */
  lines: CartLine[];
  count: number;
  subtotal: number;
  /** Steppers. A quantity never goes below zero. */
  adjust: (id: string, delta: number) => void;
  /** Voice and any other bulk path: set an absolute quantity. */
  add: (id: string, quantity: number) => void;
  /**
   * A whole order at once.
   *
   * Not a convenience. Calling `add` in a loop is one state update per item,
   * and a voice order does it while three illustrations are in the air — so
   * every landing re-rendered the screen the animation was playing on. One
   * update for the batch is one render for the batch.
   */
  addMany: (items: readonly { id: string; quantity: number }[]) => void;
  clear: () => void;
};

const CartContext = createContext<CartValue | null>(null);

/** Everything the app can sell, by id. */
const CATALOG = new Map(freshPicks.map(item => [item.id, item]));

export function CartProvider({ children }: { children: ReactNode }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const adjust = useCallback((id: string, delta: number) => {
    setQuantities(previous => ({
      ...previous,
      [id]: Math.max(0, (previous[id] ?? 0) + delta),
    }));
  }, []);

  const add = useCallback((id: string, quantity: number) => {
    setQuantities(previous => ({
      ...previous,
      [id]: Math.max(0, (previous[id] ?? 0) + quantity),
    }));
  }, []);

  const addMany = useCallback(
    (items: readonly { id: string; quantity: number }[]) => {
      if (!items.length) return;
      setQuantities(previous => {
        const next = { ...previous };
        for (const item of items) {
          next[item.id] = Math.max(0, (next[item.id] ?? 0) + item.quantity);
        }
        return next;
      });
    },
    [],
  );

  const clear = useCallback(() => setQuantities({}), []);

  const value = useMemo<CartValue>(() => {
    const lines: CartLine[] = [];
    for (const [id, quantity] of Object.entries(quantities)) {
      const product = CATALOG.get(id);
      // An id with no product is a data change, not a customer action; drop it
      // rather than render a nameless row with a price of NaN.
      if (!product || quantity <= 0) continue;
      lines.push({
        id,
        name: product.name,
        meta: product.meta,
        price: product.price,
        art: product.art,
        quantity,
        total: product.price * quantity,
      });
    }
    return {
      quantities,
      lines,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: lines.reduce((sum, line) => sum + line.total, 0),
      adjust,
      add,
      addMany,
      clear,
    };
  }, [quantities, adjust, add, addMany, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside a CartProvider');
  return value;
}

/** The produce illustration for a product, for the flight that carries it. */
export function artFor(productId: string): number | undefined {
  return CATALOG.get(productId)?.art;
}

/**
 * The whole catalogue row for a product, or nothing.
 *
 * So a screen that only has an id — the voice sheet works from matches, not
 * from products — can draw the thing rather than describe it. A confirmation
 * list of names and numbers is the same list whether we understood "tamatar"
 * or "kela"; the illustration is what lets someone check it at a glance, which
 * is the entire job of that screen.
 */
export function productFor(productId: string) {
  return CATALOG.get(productId);
}
