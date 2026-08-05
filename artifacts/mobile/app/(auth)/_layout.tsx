import { Stack } from 'expo-router';
import { nativeTheme } from '@workspace/latent-studio-ds/lib/native-theme';

const c = nativeTheme.colors.dark;

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify" />
    </Stack>
  );
}
