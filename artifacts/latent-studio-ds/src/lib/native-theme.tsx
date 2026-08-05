/**
 * Native (React Native / Expo) theme derived from tokens.json.
 * Import this in Expo apps; do NOT import the web index.css.
 */
import { tokens } from "../generated/tokens";

// Convert the first CSS length unit (rem or px) to a number of dp
function cssLengthToPx(val: string): number {
  if (val.endsWith("rem")) return parseFloat(val) * 16;
  return parseFloat(val);
}

export const nativeTheme = {
  colors: {
    light: tokens.color.light,
    dark: tokens.color.dark,
  },
  /** Border radius in dp — matches the web `--radius` variable */
  radius: cssLengthToPx(tokens.radius),
  /** Base spacing step in dp */
  spacing: cssLengthToPx(tokens.spacing),
  fontFamily: {
    /** Registered name for SpaceGrotesk_400Regular */
    sans: "SpaceGrotesk_400Regular",
    sansMedium: "SpaceGrotesk_500Medium",
    sansSemiBold: "SpaceGrotesk_600SemiBold",
    sansBold: "SpaceGrotesk_700Bold",
    /** Registered name for InstrumentSerif_400Regular */
    serif: "InstrumentSerif_400Regular",
    serifItalic: "InstrumentSerif_400Regular_Italic",
    /** Registered name for JetBrainsMono_400Regular */
    mono: "JetBrainsMono_400Regular",
    monoMedium: "JetBrainsMono_500Medium",
  },
} as const;

export type NativeTheme = typeof nativeTheme;
export type NativeColorPalette =
  | typeof nativeTheme.colors.light
  | typeof nativeTheme.colors.dark;
