import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const REQUIRED_FIREBASE_VARS = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
];

export const firebaseConfig = {
  apiKey: import.meta.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: import.meta.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: import.meta.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigValid = REQUIRED_FIREBASE_VARS.every(
  (key) => import.meta.env[key] && !import.meta.env[key].includes('your_')
);

export const missingFirebaseVars = REQUIRED_FIREBASE_VARS.filter(
  (key) => !import.meta.env[key] || import.meta.env[key].includes('your_')
);

export const appId = import.meta.env.REACT_APP_FIREBASE_APP_ID;
export const appIdIsValid = appId && /^[a-zA-Z0-9_-]{1,64}$/.test(appId);

let app = null;
let auth = null;
let db = null;
let googleProvider = null;

if (isFirebaseConfigValid && appIdIsValid) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();

    if (import.meta.env.REACT_APP_RECAPTCHA_SITE_KEY) {
      if (import.meta.env.DEV && import.meta.env.REACT_APP_APPCHECK_DEBUG_TOKEN) {
        window.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.REACT_APP_APPCHECK_DEBUG_TOKEN;
      }
      try {
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(import.meta.env.REACT_APP_RECAPTCHA_SITE_KEY),
          isTokenAutoRefreshEnabled: true,
        });
      } catch (e) {
        // App Check init failed — app continues without enforcement.
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) console.error('Firebase initialization failed:', e);
  }
}

export { app, auth, db, googleProvider };

