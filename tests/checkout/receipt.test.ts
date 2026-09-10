import { buildReceiptLayout, receiptHTML } from '../../src/components/checkout/receipt/receiptModel';
import type { ReceiptOrder } from '../../src/components/checkout/receipt/types';

const order: ReceiptOrder = {
  id: 'internal-doc-id', reference: 'HM-ABC234', createdAt: 1789056000000,
  lines: [{productId: 'tomato', name: 'Fresh tomatoes', quantity: 3, unitPrice: 120, lineTotal: 360}],
  subtotal:360, deliveryFee:99, discount:0, total:459,
  name:'A <script>alert(1)</script>', phone:'+923001234567',
  area:'Satellite Town', address:'House 14 & Street 2', instructions:'Call first', source:'voice',
};

test('receipt preserves final quantities and all delivery and pricing data without internal IDs', () => {
  const html = receiptHTML(order);
  for (const value of ['HASHMIMART','HM-ABC234','Fresh tomatoes','3 ×','360','459','99','Satellite Town','Cash on delivery','Call first']) expect(html).toContain(value);
  expect(html).not.toContain('internal-doc-id');
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('House 14 &amp; Street 2');
});

test('long receipt wraps all lines and grows without cutting off the customer address', () => {
  const long = {...order, address:'A very long delivery address '.repeat(14), lines:Array.from({length:25}, (_, i) => ({...order.lines[0], productId:`p-${i}`, name:`Product ${i} with a very long name to preserve`}))};
  const layout = buildReceiptLayout(long);
  expect(layout.height).toBeGreaterThan(1000);
  expect(layout.rows.every(row => row.y < layout.height)).toBe(true);
  expect(layout.rows.map(row=>row.text).join(' ')).toContain('Product 24');
  expect(layout.rows.map(row=>row.text).join(' ')).toContain('Thank you for shopping');
});
