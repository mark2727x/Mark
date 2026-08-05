/**
 * Loads all design system fonts via expo-font.
 * Call this once in the root layout; gate SplashScreen hide on fontsLoaded || fontError.
 */
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/space-grotesk";
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from "@expo-google-fonts/instrument-serif";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";

export function useDesignSystemFonts(): [boolean, Error | null] {
  const [loaded, error] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
  return [loaded, error];
}
