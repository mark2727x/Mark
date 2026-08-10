/**
 * Entry point — handles Google OAuth callback and redirects based on auth state.
 *
 * Google callback: when the user returns from https://auth.emergentagent.com,
 * the URL will contain `#session_id=<sid>`. We synchronously read the hash
 * during render (per the Emergent Auth playbook — a useEffect would run too
 * late and let the /auth/me bootstrap race with it), exchange the session_id
 * for a ShiftGuard JWT, then route the user to pick-role or the main app.
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
 * THIS BREAKS THE AUTH.
 */
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';
import { Body } from '@workspace/latent-studio-ds/components/native/typography';

const bg = nativeTheme.colors.dark.background;
const fg = nativeTheme.colors.dark.mutedForeground;

function extractSessionId(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const hash = window.location.hash ?? '';
  const match = hash.match(/session_id=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function Index() {
  const { user, loading, googleSession } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);
  const googleHandled = useRef(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [processingGoogle, setProcessingGoogle] = useState<boolean>(
    () => !!extractSessionId(),
  );

  // Handle Google OAuth callback synchronously — must run BEFORE the auth
  // bootstrap redirects the user away.
  useEffect(() => {
    if (googleHandled.current) return;
    const sid = extractSessionId();
    if (!sid) return;
    googleHandled.current = true;
    (async () => {
      try {
        const { needsRole } = await googleSession(sid);
        // Clear the hash so a refresh doesn't try to reuse the session_id.
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.replaceState(null, '', window.location.pathname);
        }
        redirected.current = true;
        if (needsRole) {
          router.replace('/(auth)/pick-role');
        }
        // If role already set, the auth-state effect below will route.
      } catch (err) {
        setGoogleError((err as Error)?.message ?? 'Google sign-in failed');
      } finally {
        setProcessingGoogle(false);
      }
    })();
  }, [googleSession, router]);

  useEffect(() => {
    if (loading || redirected.current || processingGoogle) return;
    redirected.current = true;
    if (!user) {
      router.replace('/(auth)/welcome');
    } else if (!user.role) {
      router.replace('/(auth)/pick-role');
    } else if (user.role === 'lifeguard') {
      router.replace('/(lifeguard)/feed');
    } else {
      router.replace('/(manager)/shifts');
    }
  }, [user, loading, processingGoogle, router]);

  return (
    <View
      style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
    >
      {(processingGoogle || googleError) && (
        <Body style={{ color: googleError ? nativeTheme.colors.dark.destructive : fg }}>
          {googleError ?? 'Signing you in with Google…'}
        </Body>
      )}
    </View>
  );
}
