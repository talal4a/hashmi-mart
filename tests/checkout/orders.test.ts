import { auth, account, documents, firestoreSdk } from '../support/firebase';
import { placeOrder, watchOrder, type OrderDraft } from '../../src/services/orders';
import { uploadVoiceRecording } from '../../src/services/voiceOrder';

jest.mock('../../src/services/voiceOrder', () => ({
  uploadVoiceRecording: jest.fn(),
}));

const sdk = firestoreSdk as typeof firestoreSdk & {
  collection: jest.Mock;
  addDoc: jest.Mock;
  runTransaction: jest.Mock;
  getDocFromServer: jest.Mock;
  onSnapshot: jest.Mock;
};
const uploaded = jest.mocked(uploadVoiceRecording);
const draft = (operationId: string): OrderDraft => ({
  operationId,
  lines: [{ productId: 'tomato', name: 'Tomato Organic', quantity: 2, unitPrice: 120, lineTotal: 240 }],
  subtotal: 240,
  deliveryFee: 99,
  total: 339,
  source: 'voice',
  name: 'Talal Ahmed',
  phone: '03001234567',
  address: 'House 12, Street 5',
  area: 'Satellite Town',
  instructions: 'Call before delivery',
  transcript: 'do tamatar',
  recording: { uri: 'file:///recording.m4a', durationMs: 8000 },
  interpretedItems: [{ query: 'tamatar', productId: 'tomato', quantity: 1, confidence: 'high' }],
});

beforeEach(() => {
  auth.currentUser = account;
  sdk.collection = jest.fn((_db, path) => path);
  sdk.addDoc = jest.fn(async (path, data) => {
    const id = `legacy-${documents.size}`;
    documents.set(`${path}/${id}`, data);
    return { id };
  });
  sdk.doc.mockImplementation((_db, path, id) => ({ id: id ?? 'generated-id', path: `${path}/${id ?? 'generated-id'}` }));
  sdk.runTransaction = jest.fn(async (_db, run) => run({
    get: async (ref: {path:string}) => ({ exists: () => documents.has(ref.path), data: () => documents.get(ref.path) }),
    set: (ref: {path:string}, data: Record<string, unknown>) => documents.set(ref.path, data),
  }));
  sdk.getDocFromServer = jest.fn(async (ref: {path:string}) => ({
    exists: () => documents.has(ref.path),
    data: () => ({ ...documents.get(ref.path), createdAt: { toMillis: () => 1790000000000 } }),
  }));
  sdk.onSnapshot = jest.fn();
  uploaded.mockReset();
  uploaded.mockResolvedValue({ publicId: 'voice/audio-id', secureUrl: 'https://example.com/audio.m4a', format: 'm4a', bytes: 2000 });
});

it('keeps one persisted order for repeated operation IDs and returns the first confirmed quantities', async () => {
  const first = await placeOrder(draft('one-order'));
  const retried = await placeOrder({ ...draft('one-order'), lines: [{ ...draft('one-order').lines[0], quantity: 3, lineTotal: 360 }], subtotal: 360, total: 459 });
  expect(documents.size).toBe(1);
  expect(retried.id).toBe(first.id);
  expect(retried.lines[0].quantity).toBe(2);
  expect(retried.reference).toBe(first.reference);
});

it('preserves the original recording and interpretation separately from customer-confirmed items', async () => {
  const placed = await placeOrder(draft('audio-order'));
  const saved = [...documents.values()][0];
  expect(saved).toMatchObject({
    source: 'voice',
    items: [{ productId: 'tomato', quantity: 2, unitPrice: 120, lineTotal: 240 }],
    contact: { name: 'Talal Ahmed', phone: '+923001234567', area: 'Satellite Town', instructions: 'Call before delivery' },
    voiceOrder: {
      enabled: true,
      transcript: 'do tamatar',
      audioUrl: 'https://example.com/audio.m4a',
      audioPublicId: 'voice/audio-id',
      interpretedItems: [{ productId: 'tomato', quantity: 1 }],
    },
    createdAt: 'server-timestamp',
    updatedAt: 'server-timestamp',
  });
  expect(placed.total).toBe(339);
  expect(placed.lines[0].quantity).toBe(2);
  expect(Object.isFrozen(placed.lines[0])).toBe(true);
});

it('coalesces simultaneous Place Order requests', async () => {
  const request = draft('double-tap');
  const [first, second] = await Promise.all([placeOrder(request), placeOrder(request)]);
  expect(documents.size).toBe(1);
  expect(first.id).toBe(second.id);
});

it('rejects client prices that disagree with the catalog without creating an order', async () => {
  const tampered = draft('wrong-price');
  tampered.lines[0].unitPrice = 1;
  tampered.lines[0].lineTotal = 2;
  tampered.subtotal = 2;
  tampered.total = 101;
  await expect(placeOrder(tampered)).rejects.toMatchObject({ code: 'price-changed' });
  expect(documents.size).toBe(0);
});

it('preserves the draft after a rejected write and reuses uploaded audio on retry', async () => {
  sdk.runTransaction.mockRejectedValueOnce(new Error('permission-denied'));
  const request = draft('retry-order');
  await expect(placeOrder(request)).rejects.toBeDefined();
  expect(documents.size).toBe(0);
  const placed = await placeOrder(request);
  expect(placed.lines[0].quantity).toBe(2);
  expect(placed.voiceOrder?.audioPublicId).toBe('voice/audio-id');
  expect(uploaded).toHaveBeenCalledTimes(1);
});

it('does not claim success after a timeout and keeps a late retry bound to the same transaction', async () => {
  let complete!: (value: unknown) => void;
  sdk.runTransaction.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const request = draft('timeout-order');
  const pending = placeOrder(request);
  const rejected = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
  await jest.advanceTimersByTimeAsync(30001);
  await rejected;
  const retried = placeOrder(request);
  complete({ id: 'timeout-order', reference: 'HM-ABC123', ...request, createdAt: 1790000000000, discount: 0, payment: {method:'cash_on_delivery',status:'pending'}, status:'placed' });
  const placed = await retried;
  expect(placed.reference).toBe('HM-ABC123');
  expect(sdk.runTransaction).toHaveBeenCalledTimes(1);
});

it('tracking rejects another customer’s document', () => {
  sdk.onSnapshot.mockImplementation((_ref, onValue) => {
    onValue({ exists: () => true, data: () => ({ userId: 'another-customer' }) });
    return jest.fn();
  });
  const onValue = jest.fn();
  const onError = jest.fn();
  watchOrder('private-order', onValue, onError);
  expect(onValue).not.toHaveBeenCalled();
  expect(onError).toHaveBeenCalled();
});
