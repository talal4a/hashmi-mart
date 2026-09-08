import { create } from 'zustand';

type CartState = {
  quantities: Record<string, number>;
  adjustQuantity: (id: string, delta: number) => void;
};

/** The browsing cart's only business state. Animation never delays a cart update. */
export const useCartStore = create<CartState>(set => ({
  quantities: {},
  adjustQuantity: (id, delta) => {
    if (!id || !Number.isSafeInteger(delta) || delta === 0) return;
    set(state => {
      const previous = state.quantities[id] ?? 0;
      const next = Math.max(0, previous + delta);
      if (!Number.isSafeInteger(next) || next === previous) return state;
      const quantities = { ...state.quantities };
      if (next === 0) delete quantities[id];
      else quantities[id] = next;
      return { quantities };
    });
  },
}));

export const selectCartCount = (state: Pick<CartState, 'quantities'>) =>
  Object.values(state.quantities).reduce((sum, quantity) => sum + quantity, 0);
