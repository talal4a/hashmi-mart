import { validateDelivery } from '../../src/validation/delivery';

/**
 * What has to be true before an order can be placed.
 *
 * Each message is shown under its own field, so the thing worth pinning is
 * that a failure is attributed to the right one: an error about the phone
 * number printed under the address is worse than no error at all.
 */

const good = {
  name: 'Talal Ahmed',
  phone: '300 123 4567',
  area: 'Satellite Town',
  address: 'House 12, Street 4',
  instructions: '',
};

describe('delivery details', () => {
  it('passes a complete set, with instructions left blank', () => {
    // Most orders have nothing to add, so an empty instructions box must not
    // be a reason to refuse the order.
    expect(validateDelivery(good)).toEqual({});
  });

  it('names the field that is wrong, not just that something is', () => {
    const errors = validateDelivery({ ...good, phone: '12' });
    expect(errors.phone).toBeTruthy();
    expect(errors.name).toBeUndefined();
    expect(errors.address).toBeUndefined();
  });

  it('refuses an area that is not one we deliver to', () => {
    // The list is the routing key. A free-typed zone is a rider sent to a
    // place the dispatcher cannot find.
    expect(validateDelivery({ ...good, area: '' }).area).toBeTruthy();
    expect(validateDelivery({ ...good, area: 'Mars' }).area).toBeTruthy();
  });

  it('wants more than a word for an address', () => {
    expect(validateDelivery({ ...good, address: 'home' }).address).toBeTruthy();
  });

  it('accepts a number typed with the local leading zero', () => {
    // People write Pakistani mobiles as 03xx out of habit; rejecting that is
    // rejecting how the number is actually written down.
    expect(validateDelivery({ ...good, phone: '0300 123 4567' })).toEqual({});
  });
});
