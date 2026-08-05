/**
 * Auth context — stores JWT in AsyncStorage and exposes register/login/logout.
 * Role is decoded from the /auth/me response after login.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

export type UserRole = 'lifeguard' | 'manager';

export interface AuthUser {
  id: number;
  email: string;
  phone: string;
  name: string;
  role: UserRole;
  bio?: string | null;
  certifications?: string[] | null;
  certificateAssociation?: string | null;
  certificateType?: string | null;
  certificateNumber?: string | null;
  certificateVerifiedAt?: string | null;
  zelleId?: string | null;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
}

interface AuthActions {
  register(data: {
    email: string;
    phone: string;
    password: string;
    name: string;
    role: UserRole;
    certifications?: string[];
    certificateAssociation?: string;
    certificateType?: string;
    certificateNumber?: string;
    zelleId?: string;
    bio?: string;
  }): Promise<{ email: string; verificationCode?: string }>;
  verifyCertificate(data: {
    association: string;
    certificateType: string;
    certificateNumber: string;
  }): Promise<{ verified: boolean; verificationUrl?: string }>;
  login(email: string, password: string): Promise<AuthUser>;
  verifyEmail(email: string, code: string): Promise<AuthUser>;
  resendVerification(email: string): Promise<{ verificationCode?: string }>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

const TOKEN_KEY = '@shiftguard/token';

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) {
    const error = new Error(json.error ?? res.statusText) as Error & { data?: any; status?: number };
    error.data = json;
    error.status = res.status;
    throw error;
  }
  return json;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, user: null, loading: true });

  // Bootstrap from stored token
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          const user = await apiFetch('/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setState({ token, user, loading: false });
        } else {
          setState({ token: null, user: null, loading: false });
        }
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
        setState({ token: null, user: null, loading: false });
      }
    })();
  }, []);

  const register: AuthActions['register'] = useCallback(async (data) => {
    const json = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { email: json.email, verificationCode: json.verificationCode };
  }, []);

  const verifyCertificate: AuthActions['verifyCertificate'] = useCallback(async (data) => {
    const json = await apiFetch('/auth/verify-certificate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { verified: json.verified, verificationUrl: json.verificationUrl };
  }, []);

  const login: AuthActions['login'] = useCallback(async (email, password) => {
    const json = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await AsyncStorage.setItem(TOKEN_KEY, json.token);
    setState({ token: json.token, user: json.user, loading: false });
    return json.user;
  }, []);

  const verifyEmail: AuthActions['verifyEmail'] = useCallback(async (email, code) => {
    const json = await apiFetch('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    await AsyncStorage.setItem(TOKEN_KEY, json.token);
    setState({ token: json.token, user: json.user, loading: false });
    return json.user;
  }, []);

  const resendVerification: AuthActions['resendVerification'] = useCallback(async (email) => {
    const json = await apiFetch('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return { verificationCode: json.verificationCode };
  }, []);

  const logout: AuthActions['logout'] = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setState({ token: null, user: null, loading: false });
  }, []);

  const refreshUser: AuthActions['refreshUser'] = useCallback(async () => {
    if (!state.token) return;
    const user = await apiFetch('/auth/me', {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    setState((s) => ({ ...s, user }));
  }, [state.token]);

  return (
    <AuthContext.Provider value={{ ...state, register, verifyCertificate, login, verifyEmail, resendVerification, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
