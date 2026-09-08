import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { View } from 'react-native';
import { CartFlightProvider, useCartFlight } from '../../src/components/home/cartFlight';
import FreshProductCard from '../../src/components/home/FreshProductCard';
import { freshPicks } from '../../src/data/groceryHome';

/**
 * The flight's contracts, which fail quietly rather than loudly.
 *
 * A flight that never launches, or launches to the wrong place, looks like
 * nothing happening — there is no error and no crash, just a button that seems
 * inert. So the things worth pinning are the ones with no visible failure:
 * that a card outside the provider still adds to the cart, that removing an
 * item throws nothing, and that a flight with no measured destination degrades
 * to the cart simply acknowledging the item.
 */

const item = freshPicks[0];

function Harness({ children }: { children: React.ReactNode }) {
  return (
    <NavigationContainer>
      <CartFlightProvider>{children}</CartFlightProvider>
    </NavigationContainer>
  );
}

describe('add to cart', () => {
  it('still adds when there is no flight provider above it', async () => {
    // A product card is not allowed to depend on the overlay existing: the
    // rail is reused, and a missing provider must cost the flourish, not the
    // feature.
    const onAdjust = jest.fn();
    const view = await render(
      <NavigationContainer>
        <FreshProductCard item={item} quantity={0} onAdjust={onAdjust} />
      </NavigationContainer>,
    );

    fireEvent.press(view.getByLabelText(`Add ${item.name} to cart`));
    expect(onAdjust).toHaveBeenCalledWith(1);
  });

  it('adds exactly once per press, with the provider present', async () => {
    const onAdjust = jest.fn();
    const view = await render(
      <Harness>
        <FreshProductCard item={item} quantity={0} onAdjust={onAdjust} />
      </Harness>,
    );

    fireEvent.press(view.getByLabelText(`Add ${item.name} to cart`));
    // The flight must not double-count: it is a visual, and the number is
    // owned by the screen.
    expect(onAdjust).toHaveBeenCalledTimes(1);
    expect(onAdjust).toHaveBeenCalledWith(1);
  });

  it('does not throw anything when an item is removed', async () => {
    const onAdjust = jest.fn();
    const view = await render(
      <Harness>
        <FreshProductCard item={item} quantity={2} onAdjust={onAdjust} />
      </Harness>,
    );

    fireEvent.press(view.getByLabelText(`Remove one ${item.name}`));
    expect(onAdjust).toHaveBeenCalledWith(-1);
  });
});

describe('cart flight', () => {
  it('acknowledges the item even when nothing has reported a target', async () => {
    // Before the cart has measured itself — or on a screen with no cart — the
    // arrival still ticks, so the cart's reaction is never simply lost.
    let api: ReturnType<typeof useCartFlight> | null = null;
    function Probe() {
      api = useCartFlight();
      return <View />;
    }

    await render(
      <Harness>
        <Probe />
      </Harness>,
    );

    const before = api!.arrivals.value;
    api!.fly({ x: 10, y: 10, size: 40, art: 0 });
    await waitFor(() => expect(api!.arrivals.value).toBe(before + 1));
  });

  it('hands back a no-op API outside the provider rather than throwing', () => {
    let api: ReturnType<typeof useCartFlight> | null = null;
    function Probe() {
      api = useCartFlight();
      return <View />;
    }
    render(<Probe />);
    expect(() => api?.fly({ x: 0, y: 0, size: 10, art: 0 })).not.toThrow();
    expect(() => api?.setTarget(null)).not.toThrow();
  });
});
