/**
 * Helpers for the Emergent-managed Google Auth flow.
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
 * THIS BREAKS THE AUTH.
 */
import { Platform } from 'react-native';

const EMERGENT_AUTH_URL = 'https://auth.emergentagent.com/';

/**
 * Whether Google sign-in is currently wired up on this platform.
 * Only web is supported for now — native would need a deep-link scheme.
 */
export const isGoogleAuthAvailable: boolean =
  Platform.OS === 'web' && typeof window !== 'undefined';

/**
 * Send the user to the Emergent Google auth page. When they finish, they
 * come back to the current origin with `#session_id=<sid>` appended, which
 * is picked up by the `/` (Index) route.
 */
export function startGoogleSignIn(): void {
  if (!isGoogleAuthAvailable) return;
  const redirectUrl = window.location.origin + '/';
  window.location.href = `${EMERGENT_AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}`;
}
