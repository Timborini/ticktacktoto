import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const appId = import.meta.env.REACT_APP_FIREBASE_APP_ID;
if (!appId || !/^[a-zA-Z0-9_-]{1,64}$/.test(appId)) {
  throw new Error('REACT_APP_FIREBASE_APP_ID is missing or invalid. Cannot start app.');
}

const firebaseConfig = {
  apiKey: import.meta.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: import.meta.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: import.meta.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firebase App Check when a reCAPTCHA site key is provided.
// For local development only, set REACT_APP_APPCHECK_DEBUG_TOKEN to a token
// generated in Firebase Console → App Check → Manage debug tokens.
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
    // Avoid logging in production to prevent leaking configuration details.
  }
}
