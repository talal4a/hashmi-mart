import { signupSchema, loginSchema, completeProfileSchema, forgotPasswordSchema } from '../../src/validation/Schema';
import { authErrorCode, authErrorMessage } from '../../src/utils/authErrors';
import { firestoreErrorMessage } from '../../src/utils/firestoreErrors';
import { googleErrorMessage } from '../../src/services/googleAuth';
import { fromE164, groupDigits, toE164 } from '../../src/utils/phone';

test.each([
  { name: '', email: 'test@example.com', password: 'password123' },
  { name: 'A', email: 'test@example.com', password: 'password123' },
  { name: 'A'.repeat(51), email: 'test@example.com', password: 'password123' },
  { name: 'Test User', email: 'bad-email', password: 'password123' },
  { name: 'Test User', email: 'test@example.com', password: '1234567' },
  { name: 'Test User', email: 'test@example.com', password: 'A'.repeat(65) },
])('signup rejects invalid required data: %j', data => {
  expect(signupSchema.safeParse(data).success).toBe(false);
});

test('signup accepts the minimum password, while login still accepts legacy six-character passwords', () => {
  expect(signupSchema.safeParse({ name: 'Test User', email: 'test@example.com', password: '12345678' }).success).toBe(true);
  expect(loginSchema.safeParse({ email: 'test@example.com', password: '123456' }).success).toBe(true);
  expect(loginSchema.safeParse({ email: 'test@example.com', password: '12345' }).success).toBe(false);
  expect(loginSchema.safeParse({ email: 'invalid', password: '12345678' }).success).toBe(false);
});

test('password reset requires a valid email', () => {
  expect(forgotPasswordSchema.safeParse({ email: 'test@example.com' }).success).toBe(true);
  expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
});

test.each(['', '12345', '1234567890123'])('profile rejects invalid local phone %j', phone => {
  expect(completeProfileSchema.safeParse({ name: 'Test User', phone, role: 'customer' }).success).toBe(false);
});

test('profile requires an address; blank, oversized address and invalid gender are rejected', () => {
  const required = { name: 'Test User', phone: '0300 123 4567', role: 'customer' };
  expect(completeProfileSchema.safeParse(required).success).toBe(false);
  expect(completeProfileSchema.safeParse({ ...required, address: '   ' }).success).toBe(false);
  expect(completeProfileSchema.safeParse({ ...required, address: 'House 12, Street 5, Lahore' }).success).toBe(true);
  expect(completeProfileSchema.safeParse({ ...required, address: 'x'.repeat(141) }).success).toBe(false);
  expect(completeProfileSchema.safeParse({ ...required, address: 'House 12', gender: 'invalid' }).success).toBe(false);
});

test('Pakistani phone formatting round-trips without duplicating the country code', () => {
  expect(groupDigits('0300-1234567')).toBe('300 123 4567');
  expect(toE164('0300-1234567')).toBe('+923001234567');
  expect(groupDigits(fromE164('+923001234567'))).toBe('300 123 4567');
  expect(toE164('')).toBeNull();
  expect(fromE164(null)).toBe('');
});

test.each([
  ['auth/invalid-credential', /email or password/i],
  ['auth/email-already-in-use', /already exists/i],
  ['auth/network-request-failed', /connection/i],
  ['auth/too-many-requests', /too many/i],
])('auth errors translate %s into an actionable message', (code, expected) => {
  expect(authErrorMessage({ code })).toMatch(expected);
  expect(authErrorCode({ code })).toBe(code);
});

test.each([
  ['unavailable', /connection/i],
  ['permission-denied', /permission/i],
  ['unauthenticated', /sign in/i],
])('profile errors translate %s', (code, expected) => {
  expect(firestoreErrorMessage({ code })).toMatch(expected);
});

test.each([
  ['10', /set up/i],
  ['12502', /already in progress/i],
  ['PLAY_SERVICES_NOT_AVAILABLE', /out of date/i],
  ['auth/network-request-failed', /connection/i],
])('Google errors translate %s', (code, expected) => {
  expect(googleErrorMessage({ code })).toMatch(expected);
});

test.each([null, undefined, {}, { code: 'unknown', message: 'private SDK detail' }])('unknown failures never expose raw SDK messages: %j', error => {
  expect(authErrorMessage(error, 'Try again')).toBe('Try again');
  expect(firestoreErrorMessage(error, 'Try again')).toBe('Try again');
  expect(googleErrorMessage(error)).not.toContain('private SDK detail');
});
