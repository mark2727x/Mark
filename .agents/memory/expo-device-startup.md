---
name: Expo device startup
description: Device-only startup stability guidance for ShiftGuard's Expo app.
---

## Rule
Do not initialize native modules globally in the root layout unless an active screen requires them. Expo Go can crash on-device even when Metro and web bundling pass.

**Why:** Native module compatibility problems occur during device startup and are not always visible in the web preview or workflow logs.

**How to apply:** Keep providers minimal at startup, restart the Expo workflow after native startup changes, and have the user rescan the fresh QR bundle after fully closing Expo Go.

The shared native Button should avoid relying on `ActivityIndicator` in the Expo Go runtime used here; use a text-based loading state unless the device runtime is known to provide that native view.

Date and time selection on the manager post form should remain dependency-free and inline rather than adding another native picker package.

**Why:** The Expo Go/device runtime has previously failed on optional native modules even when web bundling succeeded, and the date/time flow can be implemented safely with React Native primitives.

**How to apply:** Prefer custom calendar/time selection UI for this app unless a native picker dependency is explicitly approved and verified on the physical device.