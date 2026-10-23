/**
 * Cliente API REST para conectar con el backend de contacts en Go.
 * Maneja JWT access token y refresh automático de sesión con refresh_token.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'contacts_jwt_token';
const REFRESH_TOKEN_KEY = 'contacts_refresh_token';

// Para Android emulador usar 10.0.2.2, dispositivo físico la IP LAN, o producción
const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
export const API_BASE = process.env.EXPO_PUBLIC_API_URL || DEFAULT_URL;

let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function initApiTokens(): Promise<{ token: string | null; refreshToken: string | null }> {
  try {
    currentAccessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    currentRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (e) {
    console.warn('[apiClient] Error loading tokens from secure store:', e);
  }
  return { token: currentAccessToken, refreshToken: currentRefreshToken };
}

export async function setApiTokens(token: string | null, refreshToken: string | null): Promise<void> {
  currentAccessToken = token;
  currentRefreshToken = refreshToken;
  try {
    if (token) {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    }
    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch (e) {
    console.warn('[apiClient] Error saving tokens to secure store:', e);
  }
}

export async function refreshSession(): Promise<string | null> {
  if (!currentRefreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: currentRefreshToken }),
    });

    if (!res.ok) {
      await setApiTokens(null, null);
      return null;
    }

    const payload = await res.json();
    const data = payload.data;
    if (data?.token && data?.refresh_token) {
      await setApiTokens(data.token, data.refresh_token);
      onRefreshed(data.token);
      return data.token;
    }
  } catch (e) {
    console.warn('[apiClient] refreshSession error:', e);
  }
  return null;
}

export async function requestApi<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string; status: number }> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (currentAccessToken) {
    headers.set('Authorization', `Bearer ${currentAccessToken}`);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (networkErr: any) {
    return { error: networkErr.message || 'Network error', status: 0 };
  }

  // Si da 401 y tenemos refresh token, intentamos rotar token y reintentar 1 vez
  if (res.status === 401 && currentRefreshToken && !path.includes('/api/auth/')) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshSession();
      isRefreshing = false;
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        const retryRes = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers,
        });
        const retryPayload = await retryRes.json().catch(() => ({}));
        return {
          data: retryPayload.data !== undefined ? retryPayload.data : retryPayload,
          error: retryPayload.error,
          status: retryRes.status,
        };
      }
    } else {
      // Esperar al refresh en curso
      return new Promise((resolve) => {
        refreshSubscribers.push(async (newToken) => {
          headers.set('Authorization', `Bearer ${newToken}`);
          const retryRes = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers,
          });
          const retryPayload = await retryRes.json().catch(() => ({}));
          resolve({
            data: retryPayload.data !== undefined ? retryPayload.data : retryPayload,
            error: retryPayload.error,
            status: retryRes.status,
          });
        });
      });
    }
  }

  const payload = await res.json().catch(() => ({}));
  return {
    data: payload.data !== undefined ? payload.data : payload,
    error: payload.error,
    status: res.status,
  };
}
