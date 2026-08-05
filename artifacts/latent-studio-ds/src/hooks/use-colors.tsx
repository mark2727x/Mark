/**
 * Returns the active color palette based on the device color scheme.
 * Always returns the dark palette for apps that force dark mode.
 */
import { useColorScheme } from "react-native";
import { nativeTheme, type NativeColorPalette } from "../lib/native-theme.tsx";

export function useColors(): NativeColorPalette & { radius: number; spacing: number } {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? nativeTheme.colors.dark : nativeTheme.colors.light;
  return { ...palette, radius: nativeTheme.radius, spacing: nativeTheme.spacing };
}
