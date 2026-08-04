/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#f5f0e8",
      "foreground": "#0d0b08",
      "border": "#d5cec4",
      "card": "#ece5d8",
      "cardForeground": "#0d0b08",
      "popover": "#f5f0e8",
      "popoverForeground": "#0d0b08",
      "primary": "#ff4d00",
      "primaryForeground": "#ffffff",
      "secondary": "#e8e2d8",
      "secondaryForeground": "#1a1410",
      "muted": "#e8e2d8",
      "mutedForeground": "#7a6f5c",
      "accent": "#ffe8d8",
      "accentForeground": "#1a1410",
      "destructive": "#dc2626",
      "destructiveForeground": "#ffffff",
      "input": "#d5cec4",
      "ring": "#ff4d00",
      "chart1": "#ff4d00",
      "chart2": "#4a9e3e",
      "chart3": "#7a6f5c",
      "chart4": "#b9ae98",
      "chart5": "#e8b06a",
      "sidebar": "#ece5d8",
      "sidebarForeground": "#0d0b08",
      "sidebarBorder": "#d5cec4",
      "sidebarPrimary": "#ff4d00",
      "sidebarPrimaryForeground": "#ffffff",
      "sidebarAccent": "#e0d9cf",
      "sidebarAccentForeground": "#0d0b08",
      "sidebarRing": "#ff4d00"
    },
    "dark": {
      "background": "#0d0b08",
      "foreground": "#ece5d8",
      "border": "#221d15",
      "card": "#17130d",
      "cardForeground": "#ece5d8",
      "popover": "#17130d",
      "popoverForeground": "#ece5d8",
      "primary": "#ff4d00",
      "primaryForeground": "#0d0b08",
      "secondary": "#221d15",
      "secondaryForeground": "#cdc4b2",
      "muted": "#2c261c",
      "mutedForeground": "#7a6f5c",
      "accent": "#2c261c",
      "accentForeground": "#ece5d8",
      "destructive": "#ef4444",
      "destructiveForeground": "#0d0b08",
      "input": "#2c261c",
      "ring": "#ff4d00",
      "chart1": "#ff4d00",
      "chart2": "#7fd068",
      "chart3": "#cdc4b2",
      "chart4": "#b9ae98",
      "chart5": "#564d3d",
      "sidebar": "#13100b",
      "sidebarForeground": "#cdc4b2",
      "sidebarBorder": "#221d15",
      "sidebarPrimary": "#ff4d00",
      "sidebarPrimaryForeground": "#0d0b08",
      "sidebarAccent": "#1c1812",
      "sidebarAccentForeground": "#ece5d8",
      "sidebarRing": "#ff4d00"
    }
  },
  "fontFamily": {
    "sans": [
      "Space Grotesk",
      "sans-serif"
    ],
    "serif": [
      "Instrument Serif",
      "serif"
    ],
    "mono": [
      "JetBrains Mono",
      "monospace"
    ]
  },
  "radius": "0.125rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
