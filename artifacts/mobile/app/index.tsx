/**
 * Entry point — redirects based on auth state.
 * Shown briefly while the auth bootstrap runs; replaced by a proper screen immediately.
 */
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';

const bg = nativeTheme.colors.dark.background;

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (loading || redirected.current) return;
    redirected.current = true;
    if (!user) {
      router.replace('/(auth)/welcome');
    } else if (user.role === 'lifeguard') {
      router.replace('/(lifeguard)/feed');
    } else {
      router.replace('/(manager)/shifts');
    }
  }, [user, loading]);

  return <View style={{ flex: 1, backgroundColor: bg }} />;
}
