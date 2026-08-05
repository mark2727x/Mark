---
name: Expo device startup
description: Device-only startup stability guidance for ShiftGuard's Expo app.
---

## Rule
Do not initialize native modules globally in the root layout unless an active screen requires them. Expo Go can crash on-device even when Metro and web bundling pass.

**Why:** Native module compatibility problems occur during device startup and are not always visible in the web preview or workflow logs.

**How to apply:** Keep providers minimal at startup, restart the Expo workflow after native startup changes, and have the user rescan the fresh QR bundle after fully closing Expo Go.