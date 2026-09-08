type TaskResult = { status: number; body: string };

const mockUploadAsync = jest.fn<Promise<TaskResult>, []>();
const mockCreateUploadTask = jest.fn(
  (_url: string, _options: Record<string, unknown>) => ({
    uploadAsync: mockUploadAsync,
    cancel: jest.fn(),
  }),
);
const mockFileState = { exists: true, size: 4096 };

jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({
    get exists() {
      return mockFileState.exists;
    },
    get size() {
      return mockFileState.size;
    },
    name: 'order.m4a',
    createUploadTask: mockCreateUploadTask,
  })),
  UploadType: { MULTIPART: 'multipart' },
}));

import { postAudio } from '../../src/services/audioUpload';
import { SupportError } from '../../src/services/supportService';

/**
 * The upload path, tested for the thing that made it wrong in the field.
 *
 * A voice order that could not be sent told the customer they seemed to be
 * offline, on a connection that was fine: the request threw before it ever
 * reached the network and every throw was labelled a connectivity failure.
 * These check that the transport is actually the native multipart task, and
 * that the failures it can produce are told apart rather than collapsed.
 */

const send = () =>
  postAudio<{ text?: string }>(
    'https://worker.test/voice/transcribe',
    'test-id-token',
    'file:///order.m4a',
  );

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('expected a failure');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFileState.exists = true;
  mockFileState.size = 4096;
});

describe('postAudio', () => {
  it('streams the file natively and returns the parsed answer', async () => {
    mockUploadAsync.mockResolvedValue({
      status: 200,
      body: JSON.stringify({ text: 'do kilo tamatar' }),
    });

    await expect(send()).resolves.toEqual({ text: 'do kilo tamatar' });

    // The legacy `{ uri, name, type }` FormData part is what broke this: it is
    // rejected during encoding, so the recording never left the phone.
    const [url, options] = mockCreateUploadTask.mock.calls[0];
    expect(url).toBe('https://worker.test/voice/transcribe');
    expect(options.uploadType).toBe('multipart');
    expect(options.fieldName).toBe('file');
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer test-id-token',
    });
  });

  it('calls a recording that is not on disk missing, not offline', async () => {
    mockFileState.exists = false;

    const error = await failureOf(send);
    expect(error).toBeInstanceOf(SupportError);
    expect((error as SupportError).kind).toBe('missing-file');
    expect(mockUploadAsync).not.toHaveBeenCalled();
  });

  it('treats an empty recording the same way', async () => {
    mockFileState.size = 0;

    expect((await failureOf(send)) as SupportError).toHaveProperty(
      'kind',
      'missing-file',
    );
    expect(mockUploadAsync).not.toHaveBeenCalled();
  });

  it('maps a rejected token to the sign-in failure, not a network one', async () => {
    mockUploadAsync.mockResolvedValue({ status: 401, body: '' });

    expect((await failureOf(send)) as SupportError).toHaveProperty(
      'kind',
      'unauthenticated',
    );
  });

  it('reports a backend that answers with something other than JSON', async () => {
    mockUploadAsync.mockResolvedValue({ status: 200, body: '<html>nope</html>' });

    expect((await failureOf(send)) as SupportError).toHaveProperty(
      'kind',
      'unavailable',
    );
  });

  it('still reports offline when the transport itself fails', async () => {
    mockUploadAsync.mockRejectedValue(new Error('Network request failed'));

    expect((await failureOf(send)) as SupportError).toHaveProperty(
      'kind',
      'offline',
    );
  });
});
