import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { API_BASE, initApiTokens, setApiTokens } from './apiClient';
import { type ApiSession, type AuthResult, loginRequest, registerRequest } from './authApi';
import { resetSyncState } from './apiSync';
import { db, isTauri } from './db';
import { auth, db_firebase } from './firebase';
import { buildLocalDataResetStatements } from './localDataReset';
import { rcAddListener, rcConfigure, rcIsLicensed, rcLogOut } from './purchases';

const GUEST_KEY = 'auth_guest_mode';
const DRIVE_TOKEN_KEY = 'drive_access_token';
const DRIVE_TOKEN_EXPIRY_KEY = 'drive_token_expiry';
/** Margen: 55 min. Los tokens de Google duran 1 h; refrescamos antes de que expiren. */
const TOKEN_LIFETIME_MS = 55 * 60 * 1000;

interface AuthState {
  user: User | null;
  isGuest: boolean;
  /** Backend (email/password) session, restored from secure storage on start. */
  apiSession: boolean;
  /** True when any sign-in method (Google, email/password, guest) grants access. */
  isAuthenticated: boolean;
  licensed: boolean;
  loading: boolean;
  driveToken: string | null;
  loginWithPassword: (email: string, password: string) => Promise<AuthResult>;
  registerWithPassword: (email: string, name: string, password: string) => Promise<AuthResult>;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  setDriveToken: (token: string | null) => void;
  refreshDriveToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isGuest: false,
  apiSession: false,
  isAuthenticated: false,
  licensed: false,
  loading: true,
  driveToken: null,
  loginWithPassword: async () => ({ ok: false, errorKey: 'authGeneric' }),
  registerWithPassword: async () => ({ ok: false, errorKey: 'authGeneric' }),
  signIn: async () => {},
  signOutUser: async () => {},
  continueAsGuest: async () => {},
  setDriveToken: () => {},
  refreshDriveToken: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [licensed, setLicensed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [apiSession, setApiSession] = useState(false);
  const [apiRestored, setApiRestored] = useState(false);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  // Hold the auth gate until both Firebase and the stored API session have been checked.
  const loading = authLoading || !apiRestored;

  // Restore a backend session from secure storage. Firebase's null callback on cold start must not clear it.
  useEffect(() => {
    let cancelled = false;
    initApiTokens()
      .then(({ token }) => {
        if (!cancelled) setApiSession(!!token);
      })
      .finally(() => {
        if (!cancelled) setApiRestored(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const checkLicense = useCallback(async (uid: string) => {
    try {
      if (Platform.OS === 'android') {
        // Android: RevenueCat es la fuente de verdad
        await rcConfigure(uid);
        const active = await rcIsLicensed();
        setLicensed(active);
        // Escucha cambios en tiempo real (ej. tras una compra)
        rcAddListener(setLicensed);
      } else {
        // Web/desktop: Firestore
        const snap = await getDoc(doc(db_firebase, 'licenses', uid));
        setLicensed(snap.exists() && snap.data()?.licensed === true);
      }
    } catch {
      setLicensed(false);
    }
  }, []);

  /** Guarda el token en estado y lo persiste en AsyncStorage con timestamp de expiración. */
  const persistDriveToken = useCallback(async (token: string | null) => {
    setDriveToken(token);
    if (token) {
      const expiry = String(Date.now() + TOKEN_LIFETIME_MS);
      await AsyncStorage.setItem(DRIVE_TOKEN_KEY, token);
      await AsyncStorage.setItem(DRIVE_TOKEN_EXPIRY_KEY, expiry);
    } else {
      await AsyncStorage.removeItem(DRIVE_TOKEN_KEY);
      await AsyncStorage.removeItem(DRIVE_TOKEN_EXPIRY_KEY);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setIsGuest(false);
        await AsyncStorage.removeItem(GUEST_KEY);
        await checkLicense(u.uid);

        if (Platform.OS === 'android') {
          try {
            const { GoogleSignin } = require('@react-native-google-signin/google-signin');
            const tokens = await GoogleSignin.getTokens();
            await persistDriveToken(tokens.accessToken);
          } catch {}
        } else {
          try {
            const stored = await AsyncStorage.getItem(DRIVE_TOKEN_KEY);
            const expiry = await AsyncStorage.getItem(DRIVE_TOKEN_EXPIRY_KEY);
            if (stored && expiry && Date.now() < Number(expiry)) {
              setDriveToken(stored);
            }
          } catch {}
        }
      } else {
        setLicensed(false);
        const guest = await AsyncStorage.getItem(GUEST_KEY);
        if (guest === 'true') setIsGuest(true);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, [checkLicense, persistDriveToken]);

  const signIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');

    if (Platform.OS === 'web') {
      // Desktop (Tauri) signs in with email + password only; the login screen never offers Google there.
      if (isTauri()) throw new Error('Google sign-in is not available in the desktop app. Use email and password.');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) await persistDriveToken(credential.accessToken);
      return;
    }

    // Android: OAuth se maneja desde login.native.tsx via expo-auth-session
    throw new Error('USE_EXPO_AUTH');
  }, [persistDriveToken]);

  const startApiSession = useCallback(async (result: AuthResult): Promise<AuthResult> => {
    if (result.ok) {
      const session: ApiSession = result.session;
      await setApiTokens(session.token, session.refreshToken);
      await AsyncStorage.removeItem(GUEST_KEY);
      setIsGuest(false);
      setApiSession(true);
    }
    return result;
  }, []);

  const loginWithPassword = useCallback(
    async (email: string, password: string) => startApiSession(await loginRequest(fetch, API_BASE, email, password)),
    [startApiSession]
  );

  const registerWithPassword = useCallback(
    async (email: string, name: string, password: string) =>
      startApiSession(await registerRequest(fetch, API_BASE, email, name, password)),
    [startApiSession]
  );

  const signOutUser = useCallback(async () => {
    // Closing an API session: wipe local user data and sync state so the next user
    // of this device does not see it. Failures must not block the sign-out itself.
    if (apiSession) {
      try {
        await db.execAsync('BEGIN');
        try {
          for (const sql of buildLocalDataResetStatements()) await db.execAsync(sql);
          await db.execAsync('COMMIT');
        } catch (e) {
          try { await db.execAsync('ROLLBACK'); } catch { /* ignore */ }
          throw e;
        }
        await resetSyncState();
      } catch (e) {
        console.warn('[auth] no se pudieron borrar los datos locales al cerrar sesión:', e);
      }
    }
    await signOut(auth);
    await setApiTokens(null, null);
    setApiSession(false);
    setIsGuest(false);
    setLicensed(false);
    await rcLogOut();
    await persistDriveToken(null);
    await AsyncStorage.removeItem(GUEST_KEY);
  }, [persistDriveToken, apiSession]);

  const continueAsGuest = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_KEY, 'true');
    setIsGuest(true);
  }, []);

  /**
   * Refresca el Drive access token sin interacción del usuario cuando es posible.
   * - Android: GoogleSignin maneja el refresh automáticamente.
   * - Web: retorna null para que el caller muestre el diálogo de sign-in.
   */
  const refreshDriveToken = useCallback(async (): Promise<string | null> => {
    if (Platform.OS === 'android') {
      try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        const tokens = await GoogleSignin.getTokens();
        await persistDriveToken(tokens.accessToken);
        return tokens.accessToken;
      } catch {
        return null;
      }
    }

    return null;
  }, [persistDriveToken]);

  return (
    <AuthContext.Provider value={{ user, isGuest, apiSession, isAuthenticated: !!user || isGuest || apiSession, licensed, loading, driveToken, loginWithPassword, registerWithPassword, signIn, signOutUser, continueAsGuest, setDriveToken, refreshDriveToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
