import { parseOrder } from '../../src/services/voiceOrder';
import { account, emitAuth } from '../support/firebase';

// The service only needs `File`/`UploadType` to exist at import time; nothing
// here uploads.
jest.mock('expo-file-system', () => ({ File: jest.fn(), UploadType: {} }));

/**
 * The parser's contract with the Worker, tested at the seam.
 *
 * `parseOrder` used to trust whatever came back: `data.items ?? []`. A Worker
 * that answered with the wrong shape — a 200 carrying `{}`, or a body that was
 * not JSON at all — therefore looked exactly like "no groceries were spoken",
 * and the sheet told the customer we had understood them and found nothing.
 * These pin the distinction: an explicit empty list is a valid parse, a
 * malformed one is a service failure the hook can recover from with the
 * transcript it already has.
 *
 * Firebase is mocked once, globally, in tests/setup.ts — a per-file
 * `jest.mock` of `src/config/firebase` would be shadowed by it, because the
 * setup file already loads the module. Sign the test user in instead.
 */

const mockFetch = jest.fn();
const originalFetch = global.fetch;

beforeEach(() => {
  emitAuth(account);
  global.fetch = mockFetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

it('accepts an explicitly empty list as a valid parse', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ items: [], language: 'ur' }),
  });
  await expect(parseOrder('کچھ چاہیے')).resolves.toEqual({
    items: [],
    language: 'ur',
  });
});

it.each([
  null,
  {},
  { items: 'banana' },
  { items: [null] },
  { items: [{ query: 12 }] },
  { items: [{ query: ' ' }] },
])('reports malformed success data as a service error: %j', payload => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => payload });
  return expect(parseOrder('مجھے کیلے چاہیے')).rejects.toMatchObject({
    kind: 'unavailable',
  });
});

it('rejects invalid JSON without calling the customer offline', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => {
      throw new SyntaxError('bad JSON');
    },
  });
  await expect(parseOrder('banana')).rejects.toMatchObject({
    kind: 'unavailable',
  });
});

it('preserves valid quantities but does not accept string or non-finite guesses', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      items: [
        { query: ' banana ', quantity: 3, unit: 'piece' },
        { query: 'tomato', quantity: '9' },
        { query: 'spinach', quantity: Infinity },
      ],
    }),
  });
  await expect(parseOrder('groceries')).resolves.toEqual({
    items: [
      { query: 'banana', quantity: 3, unit: 'piece' },
      { query: 'tomato' },
      { query: 'spinach' },
    ],
  });
});

it('sends the transcript with the signed-in user’s token', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
  await parseOrder('do kilo tamatar');
  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/voice\/parse$/),
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer test-id-token',
      }),
      body: JSON.stringify({ transcript: 'do kilo tamatar' }),
    }),
  );
});

it('is unauthenticated with nobody signed in, before any request is made', async () => {
  emitAuth(null);
  await expect(parseOrder('banana')).rejects.toMatchObject({
    kind: 'unauthenticated',
  });
  expect(mockFetch).not.toHaveBeenCalled();
});
