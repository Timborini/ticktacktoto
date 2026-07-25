import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase.js';
import { FIREBASE_INIT_TIMEOUT_MS } from '../constants.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);

  useEffect(() => {
    let authCompleted = false;

    const loadingTimeout = setTimeout(() => {
      if (!authCompleted) {
        if (import.meta.env.DEV) console.error('Firebase initialization timeout');
        setFirebaseError('Connection timeout. Please check your internet connection and refresh the page.');
        setIsAuthReady(true);
      }
    }, FIREBASE_INIT_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        authCompleted = true;
        setUser(firebaseUser);
        setUserId(firebaseUser.uid);
        setIsAuthReady(true);
        clearTimeout(loadingTimeout);
      } else {
        signInAnonymously(auth)
          .then(() => {
            // Auth state will be updated by onAuthStateChanged
          })
          .catch((err) => {
            authCompleted = true;
            if (import.meta.env.DEV) console.error('Anonymous sign-in error:', err);
            setFirebaseError('Failed to sign in anonymously. Please refresh the page.');
            setIsAuthReady(true);
            clearTimeout(loadingTimeout);
          });
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Google login error:', error.code, error.message);
      setFirebaseError('Failed to sign in with Google.');
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Logout error:', error);
    }
  }, []);

  const clearFirebaseError = useCallback(() => setFirebaseError(null), []);

  const value = {
    user,
    userId,
    isAuthReady,
    firebaseError,
    clearFirebaseError,
    handleGoogleLogin,
    handleLogout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
