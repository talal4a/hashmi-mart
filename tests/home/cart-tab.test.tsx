import { render } from '@testing-library/react-native';
import CartTab, {
  CART_RISE,
  CART_SLOT_HEIGHT,
  LIFT,
  MODEL,
  PEDESTAL_H,
  PEDESTAL_W,
} from '../../src/components/home/CartTab';

/**
 * The cart's proportions, which are a specification rather than a preference.
 *
 * Every number here was given as a range and every one of them was missed at
 * least once — first at 2.6x a nav icon and floating clear of the bar, then
 * flat and too small. Ranges that can only be checked by rebuilding and looking
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

  it('gives the pedestal the specified footprint', () => {
    expect(PEDESTAL_W).toBeGreaterThanOrEqual(58);
    expect(PEDESTAL_W).toBeLessThanOrEqual(68);
    expect(PEDESTAL_H).toBeGreaterThanOrEqual(38);
    expect(PEDESTAL_H).toBeLessThanOrEqual(44);
  });

  it('lifts the cart clear of the pedestal without detaching it', () => {
    expect(LIFT).toBeGreaterThanOrEqual(5);
    expect(LIFT).toBeLessThanOrEqual(8);
  });

  it('lands the pedestal inside the bar with room for the label', () => {
    // The rise is derived so the pedestal ends at 52 of the bar's 72, leaving
    // the label its row. If that arithmetic breaks, the label ends up over the
    // cutout or off the bar entirely.
    const pedestalBottom = -CART_RISE + MODEL + LIFT + PEDESTAL_H;
    expect(pedestalBottom).toBe(52);
  });

  it('reserves the whole stack before anything renders into it', () => {
    // The bar must not resize when artwork loads, so the slot's height covers
    // cart, lift and pedestal rather than measuring whatever arrives.
    expect(CART_SLOT_HEIGHT).toBeGreaterThanOrEqual(MODEL + LIFT + PEDESTAL_H);
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
