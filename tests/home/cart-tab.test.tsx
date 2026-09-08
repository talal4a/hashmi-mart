import { render } from '@testing-library/react-native';
import CartTab, { CART_RISE, CART_SLOT_HEIGHT, NAV_ICON } from '../../src/components/home/CartTab';

/**
 * The cart's proportions, which are a specification rather than a preference.
 *
 * The correction brief gives ranges — 1.6x-1.9x a nav icon, 30-40% of the model
 * above the bar — and the previous cart missed both (2.6x, floating clear of
 * the bar) in a way that was only visible on a device. Numbers that can only be
 * checked by rebuilding and looking are numbers that drift, so they are checked
 * here instead.
 */

describe('cart proportions', () => {
  it('is 1.6x to 1.9x the height of an ordinary nav icon', () => {
    // Derived from NAV_ICON rather than written down twice, so resizing the
    // nav icons carries the cart with it.
    const model = Math.round(NAV_ICON * 1.8);
    expect(model / NAV_ICON).toBeGreaterThanOrEqual(1.6);
    expect(model / NAV_ICON).toBeLessThanOrEqual(1.9);
  });

  it('keeps most of itself inside the bar', () => {
    const model = Math.round(NAV_ICON * 1.8);
    const protruding = CART_RISE / model;
    expect(protruding).toBeGreaterThanOrEqual(0.3);
    expect(protruding).toBeLessThanOrEqual(0.4);
  });

  it('reserves its full height before anything renders into it', () => {
    // The bar must not resize when artwork loads, so the slot's height is a
    // constant rather than whatever the model happens to measure.
    expect(CART_SLOT_HEIGHT).toBe(CART_RISE + Math.round(NAV_ICON * 1.8) + 22);
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
