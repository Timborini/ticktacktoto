# TickTackToto - Time Tracker App

A slick ticket time tracker built with React 19, Vite, Tailwind CSS v4, and Firebase (Auth + Firestore).

## Environment Setup

This app requires Firebase configuration via environment variables. See `.env.example` for the full list.

### Local Development

1. Copy `.env.example` to `.env` and fill in your values:

```env
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
REACT_APP_FIREBASE_APP_ID=your_firebase_app_id_here
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id_here
REACT_APP_DATA_APP_ID=default-app-id
REACT_APP_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

2. `REACT_APP_FIREBASE_APP_ID` is the real Firebase web app ID (e.g. `1:123456:web:abcdef`) from the Firebase Console.
3. `REACT_APP_DATA_APP_ID` is the Firestore data namespace (`/artifacts/{id}/...`), **not** the Firebase app ID. It must match `^[a-zA-Z0-9_-]{1,64}$`. Do not change it once data exists.

### Deployment

For production deployment (e.g., Netlify), set the same environment variables in your deployment platform's environment settings.

### Google Sheets Export Setup

To enable Google Sheets export:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Google Sheets API and Google Drive API
3. Create OAuth 2.0 credentials (Web application type)
4. Add authorized JavaScript origins: `http://localhost:5173` and your production domain
5. Copy the Client ID to your `.env` file as `REACT_APP_GOOGLE_CLIENT_ID`

## Available Scripts

### `npm start`

Runs the app in development mode with Vite.\
Open [http://localhost:5173](http://localhost:5173) to view it in your browser.

### `npm test`

Runs the unit tests once with Vitest.

### `npm run test:rules`

Runs the Firestore security-rules tests against the local Firestore emulator.
Requires the [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`) and a Java runtime.

### `npm run lint`

Runs ESLint over the source tree.

### `npm run build`

Builds the app for production to the `build` folder.

### `npm run preview`

Serves the production build locally for verification.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs lint, unit tests, the
production build, and the Firestore rules tests on every push and PR.

## Firestore Security Rules

Security rules live in `firestore.rules` and are deployed with:

```
firebase deploy --only firestore:rules
```

The rules enforce per-user data isolation, field-level validation on writes,
membership-gated public share collections, and a default-deny catch-all.

## Tech Stack

- React 19 + Vite
- Tailwind CSS v4
- Firebase Auth (anonymous + Google) and Cloud Firestore
- Vitest + Testing Library for tests
