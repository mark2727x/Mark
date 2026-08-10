# ShiftGuard Auth Testing Playbook

## Flow overview

1. User taps "Continue with Google" on `/login` or `/register`.
2. Web app navigates to `https://auth.emergentagent.com/?redirect=<origin>/auth/callback`.
3. After Google consent, user lands at `<origin>/auth/callback#session_id=<sid>`.
4. Frontend synchronously reads `session_id` from `window.location.hash`, POSTs it
   to `POST /api/auth/google-session`.
5. Backend calls `GET https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data`
   with `X-Session-ID`, upserts the ShiftGuard user in Postgres by email, and issues
   our own JWT (7-day expiry). Response = `{ token, user, needsRole }`.
6. If `needsRole` is true, frontend routes to `/auth/pick-role` — user picks
   `lifeguard` or `manager` → `POST /api/auth/set-role` finalizes the account
   and returns the updated user.
7. If `needsRole` is false, user is dropped straight into the app.

## Test flow

### Backend curl
```bash
API=https://stripe-payment-21.preview.emergentagent.com/api

# 1. Exchange a Google session_id for a ShiftGuard JWT
curl -X POST $API/auth/google-session \
  -H "Content-Type: application/json" \
  -d '{"session_id":"<paste-from-callback-fragment>"}'
# → { token, user, needsRole }

# 2. Verify the JWT works
curl -X GET $API/auth/me -H "Authorization: Bearer <token>"

# 3. Pick a role
curl -X POST $API/auth/set-role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"role":"lifeguard","phone":"5555550100"}'
```

### Web UI
1. Open https://stripe-payment-21.preview.emergentagent.com
2. Click "Sign in" → "Continue with Google"
3. Complete Google consent
4. Verify you land on `/auth/pick-role` (first time only) or the app home (subsequent logins).
5. On pick-role screen, choose Pool Manager (skips the certificate check).
6. Verify AsyncStorage has `@shiftguard/token` set (DevTools → Application → Local Storage).

### Native
Not yet wired — the WebBrowser-based flow will land the user back in the app via a deep link.
Web flow only for the current release.

## Success indicators
- `/api/auth/me` returns 200 with user JSON after Google login.
- Same email used with Google links to the pre-existing password account (no duplicate row).
- Users created via Google without a role are routed to `/auth/pick-role`.

## Failure indicators
- 400 "Invalid session" on /google-session → the session_id has expired (they're single-use).
- 401 on subsequent requests → JWT signing secret mismatch between the API server processes.
- Duplicate email row → the upsert-by-email logic in /google-session is broken.
