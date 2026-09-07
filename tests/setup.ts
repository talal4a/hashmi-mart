import '@testing-library/react-native';
import { resetFirebase } from './support/firebase';
import { forgetUserDocument } from '../src/services/users';

jest.mock('../src/config/firebase', () => require('./support/firebase'));
jest.mock('firebase/firestore', () => require('./support/firebase').firestoreSdk);
jest.mock('firebase/auth', () => require('./support/firebase').authSdk);
jest.mock('@react-native-google-signin/google-signin', () => require('./support/firebase').googleSdk);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock'));

beforeEach(() => {
  jest.useFakeTimers();
  resetFirebase();
  forgetUserDocument();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});
