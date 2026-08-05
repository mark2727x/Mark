---
name: Mobile auth sessions
description: Durable session and verification constraints for the ShiftGuard mobile app.
---

## Rule
Mobile auth tokens must be verifiable without server process memory. Store the token on-device and sign it with the shared server session secret; do not use an in-memory token map.

**Why:** Replit workflows can rebuild or restart while the Expo app remains open. An in-memory token map then rejects the stored token, which looks like a delayed navigation refresh or redirect loop.

**How to apply:** Keep bootstrap auth separate from route navigation, guard the initial redirect so it runs once, and verify the persisted token through `/auth/me`. Email verification must complete before issuing an authenticated session.