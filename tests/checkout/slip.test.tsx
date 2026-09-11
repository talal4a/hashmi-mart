import { act, fireEvent, render } from '@testing-library/react-native';
import OrderSlip from '../../src/components/checkout/OrderSlip';
import type { Receipt } from '../../src/services/receipt';
import type { CartLine } from '../../src/state/cart';

/**
 * The printed slip, and the one interaction on it.
 *
 * Everything here is motion, and motion has no assertions worth writing — but
 * the things around it do, and each of them is an invisible failure:
 *
 *   a slip that never measured itself never feeds, and shows an empty machine
 *   a tear offered before the paper is out cuts through nothing
 *   a tear that never reports back leaves the screen waiting on it for ever
 *   a second tear on a slip already in two pieces cuts it again
 *
 * None of those throw. They just look like the button not working.
 *
 * The whole lifecycle is one test on purpose. In this harness, pressing a
 * `PressableScale` and then advancing the fake timers leaves the *next*
 * `render` in the file returning a null tree — a component-wide quirk, not
 * anything about this component, and one that shows up as "unable to find
 * element" a test later. One slip, pressed through its whole life, avoids it
 * and is a truer description of the thing anyway.
 */

const lines: CartLine[] = [
  {
    id: 'tomato',
    name: 'Tomato Organic',
    meta: 'Natural · 500 g',
    price: 120,
    art: 0,
    quantity: 2,
    total: 240,
  },
];

const receipt: Receipt = {
  reference: 'HM-8842',
  lines,
  subtotal: 300,
  discount: 60,
  deliveryFee: 99,
  total: 339,
  name: 'Ayesha',
  phone: '300 123 4567',
  area: 'Satellite Town',
  address: 'House 12, Gulberg',
  placedAt: new Date('2026-09-11T10:30:00Z'),
};

const props = { receipt };

/**
 * The layout pass a real screen would give it.
 *
 * The slip measures itself to know where to cut, so nothing about it starts
 * until it has a height. The handlers are called rather than fired, because
 * `fireEvent` does not route a 'layout' event to a plain View's `onLayout` —
 * firing one looks like it worked and leaves the slip waiting to be measured.
 */
const layOut = async (view: Awaited<ReturnType<typeof render>>) => {
  await act(async () => {
    view.getByTestId('order-slip-bay').props.onLayout({
      nativeEvent: { layout: { width: 300, height: 460, x: 0, y: 0 } },
    });
    view.getByTestId('order-slip-face').props.onLayout({
      nativeEvent: { layout: { width: 300, height: 420, x: 0, y: 0 } },
    });
  });
};

const tick = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

/**
 * A press, and the act that goes with it.
 *
 * `fireEvent` opens its own synchronous act; leaving it to interleave with the
 * async one in `tick` is what produces the "act without await" warning, and the
 * warning is the honest report of two overlapping scopes rather than noise.
 */
const press = async (node: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(node);
  });
};

/** Just past the feed, and just past the cut. */
const PRINTED = 1600;
const CUT = 1100;

describe('the order slip', () => {
  it('prints what was actually bought, not just the reference', async () => {
    const view = await render(<OrderSlip {...props} />);

    // The reference is the thing the customer will be asked for, so it is on
    // the paper rather than only in a sentence above it.
    expect(view.getAllByText('HM-8842').length).toBeGreaterThan(0);
    expect(view.getAllByText('Tomato Organic').length).toBeGreaterThan(0);
    expect(view.getAllByText('Rs. 339').length).toBeGreaterThan(0);
    // A waived delivery fee reads as a decision; "Rs. 0" reads as a bug.
    expect(view.getAllByText('Rs. 99').length).toBeGreaterThan(0);
    // Subtotal is the list price and the discount is the difference, so the
    // three lines add up to what is actually charged. Printing the reduced
    // price as the subtotal and then subtracting the saving again would take
    // the discount off twice.
    expect(view.getAllByText('Rs. 300').length).toBeGreaterThan(0);
    expect(view.getAllByText('- Rs. 60').length).toBeGreaterThan(0);
    // And where it is going, which is the half of a docket that matters when
    // somebody else is carrying it.
    expect(view.getAllByText('Satellite Town').length).toBeGreaterThan(0);
  });

  it('feeds, refuses to be cut early, then tears exactly once', async () => {
    const onTorn = jest.fn();
    const view = await render(<OrderSlip {...props} onTorn={onTorn} />);
    await layOut(view);

    // Still printing. There is nothing out of the machine to cut yet, and the
    // button says so rather than silently doing nothing when it is pressed.
    expect(
      view.getByLabelText('Tear off the slip').props.accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: true }));
    expect(onTorn).not.toHaveBeenCalled();

    // The feed has to finish before the cutter has anything to work on.
    await tick(PRINTED);
    expect(onTorn).not.toHaveBeenCalled();
    expect(
      view.getByLabelText('Tear off the slip').props.accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: false }));

    // Now it is out, so it can come off.
    await press(view.getByLabelText('Tear off the slip'));
    await tick(CUT);

    // Reported exactly once, and reported at all — the settle runs off a timer
    // rather than off the last animation callback, so an interrupted cut still
    // tells the screen it happened.
    expect(onTorn).toHaveBeenCalledTimes(1);
    // The label is the receipt for the receipt: the slip is off the machine
    // and the button has stopped offering to cut it.
    expect(view.getByLabelText('Slip torn off')).toBeTruthy();
    expect(view.queryByLabelText('Tear off the slip')).toBeNull();

    // And pressing the two pieces does not cut them again. There is no
    // un-tearing a slip, so the second press has nothing to do.
    await press(view.getByLabelText('Slip torn off'));
    await tick(CUT);
    expect(onTorn).toHaveBeenCalledTimes(1);
  });
});
