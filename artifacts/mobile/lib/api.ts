/**
 * Thin fetch helper — wraps fetch with the auth token from AsyncStorage.
 * On web the app is served same-origin so relative URLs work; on native we
 * build the absolute URL from EXPO_PUBLIC_DOMAIN which is set at build time.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BASE =
  Platform.OS === 'web'
    ? '/api'
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const TOKEN_KEY = '@shiftguard/token';

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json as T;
}
