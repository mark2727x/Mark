# ShiftGuard — Product Requirements

## Original problem statement
Add so that payment can be through stripe.

## Choices
- Payment scope: managers pay for shifts (Stripe Checkout) AND lifeguards receive payouts (Stripe Connect Express)
- Where: both mobile (Expo) and API (Node/Express)
- Modes: Stripe Checkout + Stripe Connect

## Tech / Architecture
- Monorepo (pnpm workspaces), Node 20/24, TypeScript 5.9
- API: Express 5 + Drizzle ORM (Postgres), OpenAPI-first (Orval codegen → React Query + zod)
- Mobile: Expo Router + React Query + latent-studio-ds
- Stripe: `stripe` Node SDK, Connect Express accounts, destination transfers with a 3% platform fee split 1.5%/1.5% between manager (surcharge on top of shift price) and lifeguard (deducted from payout). Stripe processing fees are separately deducted from the platform balance by Stripe.

## What's been implemented (Jan 2026)
- DB schema: `stripe_connect_account_id`, `stripe_connect_onboarded`, `stripe_customer_id` on users; `payment_status`, `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_transfer_id` on shifts; new `payment_transactions` table
- API endpoints (all under `/api`):
  - `GET /payments/config` — publishable key + platform fee
  - `POST /payments/checkout` — manager creates a Checkout session for their shift
  - `GET /payments/status/:sessionId` — poll (reconciles with Stripe if webhook lagging)
  - `POST /connect/onboarding-link` — lifeguard creates/continues Stripe Connect onboarding
  - `GET /connect/status` — lifeguard's Connect state
  - `POST /shifts/:id/payout` — manager triggers destination transfer to lifeguard after `completed`
  - `POST /stripe/webhook` — signed webhook (raw body mounted before express.json)
  - `GET /users/me/earnings` — lifeguard earnings dashboard summary + per-shift receipts
- OpenAPI spec updated with all payment schemas → typed React Query hooks + zod schemas auto-generated
- Mobile UI:
  - Lifeguard profile: "Set up Stripe payouts" card with Connect onboarding link
  - Lifeguard **Earnings** tab: lifetime total, pending vs awaiting-payout breakdown, connect-not-set-up warning, per-shift receipts (gross → fee → net)
  - Shift detail: "Pay ${amount} with Stripe" for managers on filled shifts; "Send payout to lifeguard" after completion; "Payout sent" badge when done
- Stripe sandbox provisioned (claimable). Sandbox keys wired into `artifacts/api-server/.env`.

## Setup steps (one-time for user)
1. `pnpm install` (already done)
2. `pnpm --filter @workspace/db run push` — apply the new schema
3. Restart the API server (`pnpm --filter @workspace/api-server run dev`)
4. Configure the Stripe webhook in the sandbox dashboard to POST to `<your-api>/api/stripe/webhook`
   with events `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_failed`, `account.updated`
5. Claim the sandbox at the onboarding URL when ready to go live

## Test flow
- Register a lifeguard → open Profile → "Set up Stripe payouts" → complete Stripe onboarding (test data)
- Register a manager → post a shift, have the lifeguard pick it up
- Manager opens shift → "Pay $X with Stripe" → Checkout in browser → test card `4242 4242 4242 4242`
- Manager marks shift completed → "Send payout to lifeguard" transfers 90% of the amount

## Backlog / next
- P1: Success/cancel deep-link handling for mobile (return to app after Checkout)
- P1: Refund endpoint for cancelled-after-paid shifts
- P2: Manager billing history / lifeguard earnings dashboard
- P2: Automatic payout on shift completion (skip the extra button)
