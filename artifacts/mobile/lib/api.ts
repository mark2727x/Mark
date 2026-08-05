/**
 * Thin fetch helper — wraps fetch with the auth token from AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
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
