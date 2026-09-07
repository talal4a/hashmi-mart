import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import {
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import { initializeFirestore, enableNetwork, Firestore } from 'firebase/firestore';


const firebaseConfig = {
  apiKey: 'AIzaSyBS_-vaa9QaWtyyKfND-YQIZ-gAiIMkowg',
  projectId: 'hahmi-mart',
  storageBucket: 'hahmi-mart.firebasestorage.app',
  messagingSenderId: '886326794185',
  appId: '1:886326794185:android:2899d70b080fdfa01e7a18',
};

const app = initializeApp(firebaseConfig);

const getReactNativePersistence = (
  firebaseAuth as unknown as {
    getReactNativePersistence?: (storage: unknown) => Persistence;
  }
).getReactNativePersistence;

function createAuth(): Auth {
  if (!getReactNativePersistence) return getAuth(app);
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}


export const auth = createAuth();


let db: Firestore;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch {

  db = require('firebase/firestore').getFirestore(app);
}
enableNetwork(db).catch(() => {});

export { db };
