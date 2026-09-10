import type { ReceiptOrder } from './types';

export const PAPER_WIDTH = 256;
export const PAPER_COLOR = '#FAF8F3';
export const receiptMoney = (value: number) => `Rs ${value.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
export const receiptDate = (value: number) => new Date(value).toLocaleString('en-PK', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi',
});
export type ReceiptRow = {
  text: string;
  right?: string;
  y: number;
  size: number;
  bold?: boolean;
  center?: boolean;
  rule?: boolean;
  barcode?: boolean;
};

function wrap(text: string, length = 30): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && line.length + word.length + 1 > length) { lines.push(line); line = ''; }
    let rest = word;
    while (rest.length > length) { if (line) { lines.push(line); line = ''; } lines.push(rest.slice(0, length)); rest = rest.slice(length); }
    line = line ? `${line} ${rest}` : rest;
  }
  if (line) lines.push(line);
  return lines;
}

/** Vector receipt layout with clean thermal receipt typography and spacing */
export function buildReceiptLayout(order: ReceiptOrder, fontScale = 1) {
  const scale = Math.max(1, Math.min(fontScale, 1.5));
  const rows: ReceiptRow[] = [];
  let y = 28;

  const row = (text: string, options: Partial<ReceiptRow> = {}) => {
    const size = (options.size ?? 10.5) * scale;
    rows.push({ text, y, size, ...options, ...(options.size ? { size } : {}) });
    y += size + 7;
  };

  const text = (value: string) => wrap(value, Math.floor(32 / scale)).forEach(part => row(part));
  const rule = () => { y += 4; row('', { rule: true, size: 1 }); y += 6; };

  // Store Header
  row('HASHMIMART', { size: 17, bold: true, center: true });
  row('YOUR NEIGHBOURHOOD, DELIVERED', { size: 7.5, center: true });
  y += 6;
  row('ORDER CONFIRMED', { size: 9, bold: true, center: true });
  row(order.reference, { size: 12, bold: true, center: true });
  row(receiptDate(order.createdAt), { size: 8, center: true });
  rule();

  // Purchased Items
  order.lines.forEach(item => {
    text(item.name);
    row(`${item.quantity} × ${receiptMoney(item.unitPrice)}`, { right: receiptMoney(item.lineTotal), size: 9.5 });
    y += 5;
  });
  rule();

  // Order Totals
  row('Subtotal', { right: receiptMoney(order.subtotal) });
  row('Delivery', { right: order.deliveryFee ? receiptMoney(order.deliveryFee) : 'FREE' });
  if (order.discount) row('Discount', { right: `−${receiptMoney(order.discount)}` });
  y += 5;
  row('TOTAL', { right: receiptMoney(order.total), size: 14, bold: true });
  rule();

  // Payment & Delivery Details
  row('PAYMENT', { size: 8.5, bold: true });
  text('Cash on delivery');
  y += 8;
  row('DELIVER TO', { size: 8.5, bold: true });
  [order.name, order.phone, order.area, order.address].forEach(text);
  if (order.instructions) {
    y += 6;
    row('DELIVERY NOTE', { size: 8.5, bold: true });
    text(order.instructions);
  }
  rule();

  // Footer & Barcode marker
  row('Thank you for shopping', { center: true, size: 9.5 });
  row('with HashmiMart.', { center: true, size: 9.5 });
  y += 6;
  rows.push({ text: order.reference, y, size: 24, barcode: true, center: true });
  y += 32;

  return { rows, height: Math.ceil(y + 12), width: PAPER_WIDTH };
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}

/** Structured print document */
export function receiptHTML(order: ReceiptOrder): string {
  const e = escapeHTML;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(order.reference)} — HashmiMart</title><style>
  @page{margin:16mm}*{box-sizing:border-box}body{font:12px ui-monospace,Menlo,Consolas,monospace;color:#162E37;max-width:420px;margin:0 auto;line-height:1.6}header,footer{text-align:center}h1{font-size:25px;letter-spacing:2px;margin:0}h2{font-size:14px;margin:20px 0 2px}p{margin:5px 0;overflow-wrap:anywhere}.muted{font-size:10px}table{width:100%;border-collapse:collapse;margin:18px 0}td{padding:8px 0;vertical-align:top;border-bottom:1px dashed #bccbd1}td:last-child{text-align:right;white-space:nowrap}.total{font-size:18px;font-weight:700}section{border-top:1px dashed #82969e;padding:12px 0;break-inside:avoid}tr{break-inside:avoid}footer{margin-top:20px}
  </style></head><body><header><h1>HASHMIMART</h1><p class="muted">YOUR NEIGHBOURHOOD, DELIVERED</p><h2>ORDER CONFIRMED</h2><p>${e(order.reference)}</p><p>${e(receiptDate(order.createdAt))}</p></header><table><tbody>${order.lines.map(item => `<tr><td>${e(item.name)}<br>${item.quantity} × ${e(receiptMoney(item.unitPrice))}</td><td>${e(receiptMoney(item.lineTotal))}</td></tr>`).join('')}</tbody></table><table><tbody><tr><td>Subtotal</td><td>${e(receiptMoney(order.subtotal))}</td></tr><tr><td>Delivery</td><td>${e(receiptMoney(order.deliveryFee))}</td></tr>${order.discount ? `<tr><td>Discount</td><td>−${e(receiptMoney(order.discount))}</td></tr>` : ''}<tr class="total"><td>TOTAL</td><td>${e(receiptMoney(order.total))}</td></tr></tbody></table><section>Payment<p>Cash on delivery</p></section><section>Deliver to<p>${e(order.name)}<br>${e(order.phone)}<br>${e(order.area)}<br>${e(order.address)}</p>${order.instructions ? `<p>Delivery note: ${e(order.instructions)}</p>` : ''}</section><footer>Thank you for shopping<br>with HashmiMart.</footer></body></html>`;
}

