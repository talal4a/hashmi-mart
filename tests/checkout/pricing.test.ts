import { priceCheckout, revalidateCheckout, validateCheckoutContact, normalizeCheckoutPhone } from '../../src/services/checkout';
import { isDeliveryAreaSupported, configuredDeliveryAreas } from '../../src/services/deliveryAreas';

it('prices final quantities from the app catalog and applies the existing delivery threshold', () => {
  expect(priceCheckout([{ productId: 'tomato', quantity: 3 }])).toMatchObject({ subtotal: 360, deliveryFee: 99, discount: 0, total: 459 });
  expect(priceCheckout([{ productId: 'apple', quantity: 6 }])).toMatchObject({ subtotal: 1560, deliveryFee: 0, total: 1560 });
});

it('reports changed prices and unavailable items without silently dropping them', () => {
  const result = revalidateCheckout([
    {productId:'tomato',name:'Tomato Organic',quantity:2,unitPrice:100,lineTotal:200},
    {productId:'milk',name:'Milk',quantity:1,unitPrice:340,lineTotal:340},
  ]);
  expect(result.priceChanges).toEqual([{productId:'tomato',name:'Tomato Organic',previousPrice:100,currentPrice:120}]);
  expect(result.unavailable).toEqual(['milk']);
});

it.each([0, -1, NaN, Infinity, 10000])('refuses an invalid order quantity %s', quantity => {
  expect(() => priceCheckout([{ productId:'tomato',quantity }])).toThrow();
});

it('validates every required delivery field and normalizes Pakistan phones without duplicating +92', () => {
  expect(validateCheckoutContact({name:'',phone:'abc',area:'',address:''})).toEqual(expect.objectContaining({name:expect.any(String),phone:expect.any(String),area:expect.any(String),address:expect.any(String)}));
  expect(normalizeCheckoutPhone('+923001234567')).toBe('+923001234567');
  expect(normalizeCheckoutPhone('0300 123 4567')).toBe('+923001234567');
  expect(validateCheckoutContact({name:'Talal Ahmed',phone:'03001234567',area:'Satellite Town',address:'House 12, Street 5'})).toEqual({});
});

it('centralizes configured supported areas and rejects other locations when a list is configured', () => {
  expect(configuredDeliveryAreas(' Satellite Town , Peoples Colony,Satellite Town ')).toEqual(['Satellite Town','Peoples Colony']);
  expect(isDeliveryAreaSupported('SatELLite town', ['Satellite Town'])).toBe(true);
  expect(isDeliveryAreaSupported('Other city', ['Satellite Town'])).toBe(false);
  expect(isDeliveryAreaSupported('', [])).toBe(false);
});
