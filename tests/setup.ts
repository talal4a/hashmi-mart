import '@testing-library/react-native';
import { resetFirebase } from './support/firebase';
import { forgetUserDocument } from '../src/services/users';

jest.mock('../src/config/firebase', () => require('./support/firebase'));
jest.mock('firebase/firestore', () => require('./support/firebase').firestoreSdk);
jest.mock('firebase/auth', () => require('./support/firebase').authSdk);
jest.mock('@react-native-google-signin/google-signin', () => require('./support/firebase').googleSdk);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock'));

beforeEach(() => {
  // The voice pipeline prints a diagnostic block per order in development,
  // which is a feature on a phone and noise in a test run. Re-applied each
  // test rather than once, because `restoreAllMocks` below would otherwise
  // undo it after the first one. Muted here rather than switched off in the
  // source, so the tests still exercise the code that logs.
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.useFakeTimers();
  resetFirebase();
  forgetUserDocument();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});
