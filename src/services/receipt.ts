import { Platform, Share } from 'react-native';
import { money } from './pricing';
import type { CartLine } from '../state/cart';

/**
 * The order, as a receipt — on paper, on screen, or in a share sheet.
 *
 * One shape and one renderer, so the slip the customer tears off and the copy
 * they print say the same thing. A printed total that disagrees with the drawn
 * one is the single worst bug this screen could have, and two independent
 * layouts is exactly how you get one.
 */

export type Receipt = {
  reference: string;
  lines: readonly CartLine[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  name: string;
  phone: string;
  area: string;
  address: string;
  placedAt: Date;
};

const WIDTH = 34;

/** Name on the left, amount on the right, dots between. Monospace or nothing. */
function row(label: string, amount: string): string {
  const gap = Math.max(1, WIDTH - label.length - amount.length);
  return `${label}${' '.repeat(gap)}${amount}`;
}

export function receiptText(receipt: Receipt): string {
  const out: string[] = [
    'HASHMI MART',
    'Fresh grocery · Cash on delivery',
    '',
    'ORDER CONFIRMED',
    `Order ${receipt.reference}`,
    receipt.placedAt.toLocaleString('en-PK'),
    '-'.repeat(WIDTH),
  ];

  for (const line of receipt.lines) {
    out.push(row(`${line.name} x${line.quantity}`, money(line.total)));
  }

  out.push('-'.repeat(WIDTH));
  out.push(row('Subtotal', money(receipt.subtotal)));
  if (receipt.discount > 0) {
    out.push(row('Discount', `- ${money(receipt.discount)}`));
  }
  out.push(
    row(
      'Delivery',
      receipt.deliveryFee === 0 ? 'FREE' : money(receipt.deliveryFee),
    ),
  );
  out.push('-'.repeat(WIDTH));
  out.push(row('TOTAL', money(receipt.total)));
  out.push('');
  out.push('Cash on delivery');
  out.push('');
  out.push('Deliver to:');
  out.push(receipt.name);
  out.push(`+92 ${receipt.phone}`);
  out.push(receipt.area);
  out.push(receipt.address);
  out.push('');
  out.push('SHUKRIYA · THANK YOU');

  return out.join('\n');
}

/** 80mm roll, which is what a shop's thermal printer actually is. */
export function receiptHtml(receipt: Receipt): string {
  const rows = receipt.lines
    .map(
      line =>
        `<tr><td>${escape(line.name)} <span class="q">x${line.quantity}</span></td><td class="r">${money(line.total)}</td></tr>`,
    )
    .join('');

  const discount =
    receipt.discount > 0
      ? `<tr><td>Discount</td><td class="r">- ${money(receipt.discount)}</td></tr>`
      : '';

  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: "Courier New", monospace; color: #111; font-size: 12px; }
  h1 { font-size: 16px; letter-spacing: 3px; text-align: center; margin: 0 0 2px; }
  .sub, .thanks { text-align: center; color: #666; font-size: 10px; letter-spacing: 1px; }
  .rule { border-top: 1px dashed #999; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  .r { text-align: right; white-space: nowrap; }
  .q { color: #777; }
  .total td { font-size: 15px; font-weight: bold; padding-top: 6px; }
  .ref { text-align: center; font-size: 15px; font-weight: bold; letter-spacing: 2px; }
  .to { margin-top: 10px; line-height: 1.5; }
</style></head><body>
  <h1>HASHMI MART</h1>
  <div class="sub">Fresh grocery · Cash on delivery</div>
  <div class="rule"></div>
  <div class="sub">ORDER CONFIRMED</div>
  <div class="ref">${escape(receipt.reference)}</div>
  <div class="sub">${escape(receipt.placedAt.toLocaleString('en-PK'))}</div>
  <div class="rule"></div>
  <table>${rows}</table>
  <div class="rule"></div>
  <table>
    <tr><td>Subtotal</td><td class="r">${money(receipt.subtotal)}</td></tr>
    ${discount}
    <tr><td>Delivery</td><td class="r">${receipt.deliveryFee === 0 ? 'FREE' : money(receipt.deliveryFee)}</td></tr>
    <tr class="total"><td>TOTAL</td><td class="r">${money(receipt.total)}</td></tr>
  </table>
  <div class="rule"></div>
  <div class="to">
    <strong>Cash on delivery</strong><br/><br/>
    Deliver to:<br/>
    ${escape(receipt.name)}<br/>
    +92 ${escape(receipt.phone)}<br/>
    ${escape(receipt.area)}<br/>
    ${escape(receipt.address)}
  </div>
  <div class="rule"></div>
  <div class="thanks">SHUKRIYA · THANK YOU</div>
</body></html>`;
}

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Prints, or does the closest thing this build can do.
 *
 * `expo-print` is a native module, so it only exists once the app has been
 * rebuilt after it was added to the manifest. Importing it at the top of the
 * file would mean a JS bundle that will not evaluate on an older binary — the
 * whole screen gone, over a button most customers never press. So it is
 * resolved at the moment of use, and when it is not there the receipt goes to
 * the share sheet instead, which is core React Native and always present.
 *
 * Returns how it went, so the caller can say "Sent" rather than "Printed" when
 * that is what happened.
 */
export type PrintOutcome = 'printed' | 'shared' | 'cancelled' | 'failed';

export async function printReceipt(receipt: Receipt): Promise<PrintOutcome> {
  const printer = loadPrinter();
  if (printer) {
    try {
      await printer.printAsync({
        html: receiptHtml(receipt),
        ...(Platform.OS === 'ios' ? { width: 226 } : null),
      });
      return 'printed';
    } catch (caught) {
      // The iOS print sheet rejects when it is dismissed. That is a person
      // changing their mind, not a failure to report to them.
      if (isDismissal(caught)) return 'cancelled';
      // Anything else falls through to sharing: a customer who wanted a copy
      // should still get one.
    }
  }

  try {
    const result = await Share.share({
      message: receiptText(receipt),
      title: `HashmiMart ${receipt.reference}`,
    });
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return 'failed';
  }
}

type Printer = { printAsync: (options: Record<string, unknown>) => Promise<void> };

function loadPrinter(): Printer | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('expo-print') as Partial<Printer> | undefined;
    return typeof module?.printAsync === 'function'
      ? (module as Printer)
      : null;
  } catch {
    return null;
  }
}

function isDismissal(caught: unknown): boolean {
  const message =
    caught instanceof Error ? caught.message : String(caught ?? '');
  return /cancel|dismiss/i.test(message);
}
