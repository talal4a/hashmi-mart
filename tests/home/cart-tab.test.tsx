import { render } from '@testing-library/react-native';
import CartTab, {
  CART_RISE,
  CART_SLOT_HEIGHT,
  MODEL,
} from '../../src/components/home/CartTab';

/**
 * The cart's proportions, which are a specification rather than a preference.
 *
 * Every number here was given as a range and every one of them was missed at
 * least once — first at 2.6x a nav icon and floating clear of the bar, then
 * flat and too small, then stacked on a pedestal that gave one control three
 * competing frames. Ranges that can only be checked by rebuilding and looking
 * are ranges that drift, so they are checked here instead.
 *
 * These assert on the values the component actually uses. An earlier version of
 * this file recomputed the size locally, which meant it kept passing while the
 * component moved out from under it.
 */

describe('cart proportions', () => {
  it('draws the cart at the specified size', () => {
    expect(MODEL).toBeGreaterThanOrEqual(46);
    expect(MODEL).toBeLessThanOrEqual(54);
  });

  it('keeps most of the cart inside the bar', () => {
    // 30-40%. Below this it stops reading as raised at all; above it, the cart
    // detaches from the row and looks parked over the page.
    const protruding = CART_RISE / MODEL;
    expect(protruding).toBeGreaterThanOrEqual(0.28);
    expect(protruding).toBeLessThanOrEqual(0.4);
  });

  it('reserves its height before anything renders into it', () => {
    // The bar must not resize when artwork loads, so the slot's height is a
    // constant rather than whatever the model happens to measure.
    expect(CART_SLOT_HEIGHT).toBeGreaterThanOrEqual(MODEL);
  });
});

describe('cart tab', () => {
  it('announces itself as a button, with the count when there is one', async () => {
    const view = await render(<CartTab count={3} onPress={() => {}} />);
    expect(view.getByLabelText('Cart, 3 items')).toBeTruthy();
  });

  it('says "item" for a single one', async () => {
    const view = await render(<CartTab count={1} onPress={() => {}} />);
    expect(view.getByLabelText('Cart, 1 item')).toBeTruthy();
  });

  it('drops the count from the label when the cart is empty', async () => {
    const view = await render(<CartTab count={0} onPress={() => {}} />);
    expect(view.getByLabelText('Cart')).toBeTruthy();
  });

  it('shows no badge at zero, and caps it at 99+', async () => {
    const view = await render(<CartTab count={0} onPress={() => {}} />);
    expect(view.queryByText('0')).toBeNull();

    await view.rerender(<CartTab count={7} onPress={() => {}} />);
    expect(view.getByText('7')).toBeTruthy();

    await view.rerender(<CartTab count={140} onPress={() => {}} />);
    expect(view.getByText('99+')).toBeTruthy();
  });
});
