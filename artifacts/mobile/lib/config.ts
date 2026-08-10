/**
 * Single source of truth for the ShiftGuard API base URL.
 *
 * - On web the app is served same-origin so we use a relative /api base.
 * - On native (iOS/Android) we build the absolute URL from
 *   EXPO_PUBLIC_DOMAIN which is inlined at build time.
 */
import { Platform } from 'react-native';

export const API_BASE_URL: string =
  Platform.OS === 'web'
    ? '/api'
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

/**
 * Origin used as the `origin_url` for Stripe Checkout success/cancel URLs.
 * On web that's the current tab's origin; on native we fall back to the
 * public preview/production domain from EXPO_PUBLIC_DOMAIN.
 */
export function getPublicOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
}
