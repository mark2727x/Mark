import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import {
  db,
  usersTable,
  shiftsTable,
  paymentTransactionsTable,
} from "@workspace/db";
import { requireAuth } from "./auth";
import { logger } from "../lib/logger";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  throw new Error("STRIPE_SECRET_KEY must be set");
}
const stripe = new Stripe(stripeSecret);
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
// Platform application fee (10%) — remainder is paid out to the lifeguard.
const PLATFORM_FEE_BPS = 1000;

function computeShiftAmountCents(shift: {
  payRate: number;
  totalHours: number;
}): number {
  return Math.round(shift.payRate * shift.totalHours * 100);
}

const router: IRouter = Router();

// ── Stripe Connect (lifeguard payouts) ──────────────────────────────────────

router.post(
  "/connect/onboarding-link",
  requireAuth,
  async (req: any, res: Response): Promise<void> => {
    const [me] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId))
      .limit(1);
    if (!me || me.role !== "lifeguard") {
      res
        .status(403)
        .json({ error: "Only lifeguards can onboard as payees" });
      return;
    }
    const originUrl =
      (typeof req.body?.origin_url === "string" && req.body.origin_url) ||
      `${req.protocol}://${req.get("host")}`;

    let accountId = me.stripeConnectAccountId ?? undefined;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: me.email,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { userId: String(me.id) },
      });
      accountId = account.id;
      await db
        .update(usersTable)
        .set({ stripeConnectAccountId: accountId })
        .where(eq(usersTable.id, me.id));
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${originUrl}/connect/refresh`,
      return_url: `${originUrl}/connect/return`,
      type: "account_onboarding",
    });

    res.json({ url: link.url, accountId });
  },
);

router.get(
  "/connect/status",
  requireAuth,
  async (req: any, res: Response): Promise<void> => {
    const [me] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId))
      .limit(1);
    if (!me) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!me.stripeConnectAccountId) {
      res.json({ onboarded: false, hasAccount: false });
      return;
    }
    const account = await stripe.accounts.retrieve(
      me.stripeConnectAccountId,
    );
    const onboarded =
      account.details_submitted === true &&
      account.charges_enabled === true;
    if (onboarded && !me.stripeConnectOnboarded) {
      await db
        .update(usersTable)
        .set({ stripeConnectOnboarded: true })
        .where(eq(usersTable.id, me.id));
    }
    res.json({
      hasAccount: true,
      onboarded,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
  },
);

// ── Stripe Checkout (manager pays for a shift) ──────────────────────────────

router.post(
  "/payments/checkout",
  requireAuth,
  async (req: any, res: Response): Promise<void> => {
    const shiftId = Number(req.body?.shift_id ?? req.body?.shiftId);
    const originUrl =
      typeof req.body?.origin_url === "string" ? req.body.origin_url : "";
    if (!Number.isInteger(shiftId) || !originUrl) {
      res.status(400).json({ error: "shift_id and origin_url are required" });
      return;
    }

    const [shift] = await db
      .select()
      .from(shiftsTable)
      .where(eq(shiftsTable.id, shiftId))
      .limit(1);
    if (!shift) {
      res.status(404).json({ error: "Shift not found" });
      return;
    }
    if (shift.managerId !== req.userId) {
      res
        .status(403)
        .json({ error: "Only the shift's manager can pay for it" });
      return;
    }
    if (shift.paymentStatus === "paid") {
      res.status(400).json({ error: "This shift is already paid" });
      return;
    }
    if (shift.status === "cancelled") {
      res.status(400).json({ error: "Cannot pay for a cancelled shift" });
      return;
    }

    const amountCents = computeShiftAmountCents(shift);
    if (amountCents <= 0) {
      res.status(400).json({ error: "Shift amount must be greater than zero" });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `Shift: ${shift.title}`,
              description: `${shift.totalHours}h at $${shift.payRate.toFixed(2)}/hr — ${shift.location}`,
            },
          },
        },
      ],
      metadata: {
        shift_id: String(shift.id),
        manager_id: String(req.userId),
      },
      success_url: `${originUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${originUrl}/payment/cancel`,
    });

    await db.insert(paymentTransactionsTable).values({
      sessionId: session.id,
      shiftId: shift.id,
      payerId: req.userId,
      amountCents,
      currency: "usd",
      status: "initiated",
      paymentStatus: "pending",
    });

    await db
      .update(shiftsTable)
      .set({ stripeCheckoutSessionId: session.id })
      .where(eq(shiftsTable.id, shift.id));

    res.json({ checkout_url: session.url, session_id: session.id });
  },
);

async function reconcileFromStripe(sessionId: string): Promise<void> {
  const [tx] = await db
    .select()
    .from(paymentTransactionsTable)
    .where(eq(paymentTransactionsTable.sessionId, sessionId))
    .limit(1);
  if (!tx || tx.paymentStatus === "paid") return;

  try {
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    if (s.payment_status === "paid" || s.status === "complete") {
      await db
        .update(paymentTransactionsTable)
        .set({
          status: "completed",
          paymentStatus: "paid",
          stripePaymentIntentId:
            typeof s.payment_intent === "string" ? s.payment_intent : null,
        })
        .where(eq(paymentTransactionsTable.sessionId, sessionId));
      await db
        .update(shiftsTable)
        .set({
          paymentStatus: "paid",
          stripePaymentIntentId:
            typeof s.payment_intent === "string" ? s.payment_intent : null,
        })
        .where(eq(shiftsTable.id, tx.shiftId));
    }
  } catch (err) {
    logger.warn({ err, sessionId }, "Stripe reconcile failed");
  }
}

router.get(
  "/payments/status/:sessionId",
  async (req: Request, res: Response): Promise<void> => {
    const sessionId = String(req.params.sessionId);
    await reconcileFromStripe(sessionId);
    const [tx] = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.sessionId, sessionId))
      .limit(1);
    if (!tx) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    res.json({
      session_id: tx.sessionId,
      status: tx.status,
      payment_status: tx.paymentStatus,
      amount_cents: tx.amountCents,
      currency: tx.currency,
      shift_id: tx.shiftId,
    });
  },
);

// ── Payout to lifeguard (after shift completion) ────────────────────────────

router.post(
  "/shifts/:id/payout",
  requireAuth,
  async (req: any, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const [shift] = await db
      .select()
      .from(shiftsTable)
      .where(eq(shiftsTable.id, id))
      .limit(1);
    if (!shift) {
      res.status(404).json({ error: "Shift not found" });
      return;
    }
    if (shift.managerId !== req.userId) {
      res.status(403).json({ error: "Only the manager can send the payout" });
      return;
    }
    if (shift.status !== "completed") {
      res
        .status(400)
        .json({ error: "Shift must be marked completed before payout" });
      return;
    }
    if (shift.paymentStatus !== "paid") {
      res.status(400).json({ error: "Shift must be paid before payout" });
      return;
    }
    if (!shift.workerId) {
      res.status(400).json({ error: "Shift has no assigned lifeguard" });
      return;
    }
    if (shift.stripeTransferId) {
      res.status(400).json({ error: "Payout has already been sent" });
      return;
    }

    const [worker] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, shift.workerId))
      .limit(1);
    if (!worker?.stripeConnectAccountId || !worker.stripeConnectOnboarded) {
      res.status(400).json({
        error: "Lifeguard has not finished Stripe Connect onboarding yet",
      });
      return;
    }

    const gross = computeShiftAmountCents(shift);
    const fee = Math.round((gross * PLATFORM_FEE_BPS) / 10000);
    const payoutAmount = gross - fee;

    const transfer = await stripe.transfers.create({
      amount: payoutAmount,
      currency: "usd",
      destination: worker.stripeConnectAccountId,
      metadata: {
        shift_id: String(shift.id),
        manager_id: String(shift.managerId),
        lifeguard_id: String(worker.id),
      },
    });

    await db
      .update(shiftsTable)
      .set({ paymentStatus: "paid_out", stripeTransferId: transfer.id })
      .where(eq(shiftsTable.id, shift.id));

    res.json({
      transferId: transfer.id,
      amountCents: payoutAmount,
      platformFeeCents: fee,
    });
  },
);

// ── Public config endpoint (frontend) ───────────────────────────────────────

router.get("/payments/config", (_req: Request, res: Response): void => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null,
    platformFeeBps: PLATFORM_FEE_BPS,
  });
});

// ── Stripe webhook ──────────────────────────────────────────────────────────
//
// This router expects the raw body — the webhook is mounted separately in
// app.ts BEFORE the JSON body parser using express.raw().

export const webhookRouter: IRouter = Router();

webhookRouter.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"];
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig ?? "",
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (err: any) {
      logger.warn({ err: err?.message }, "Invalid Stripe webhook signature");
      res.status(400).send(`Webhook Error: ${err?.message}`);
      return;
    }

    try {
      if (event.type === "checkout.session.completed") {
        const s = event.data.object as Stripe.Checkout.Session;
        await db
          .update(paymentTransactionsTable)
          .set({
            status: "completed",
            paymentStatus: "paid",
            stripePaymentIntentId:
              typeof s.payment_intent === "string" ? s.payment_intent : null,
          })
          .where(eq(paymentTransactionsTable.sessionId, s.id));
        const shiftId = Number(s.metadata?.shift_id);
        if (Number.isInteger(shiftId)) {
          await db
            .update(shiftsTable)
            .set({
              paymentStatus: "paid",
              stripePaymentIntentId:
                typeof s.payment_intent === "string"
                  ? s.payment_intent
                  : null,
            })
            .where(eq(shiftsTable.id, shiftId));
        }
      } else if (event.type === "checkout.session.expired") {
        const s = event.data.object as Stripe.Checkout.Session;
        await db
          .update(paymentTransactionsTable)
          .set({ status: "expired", paymentStatus: "expired" })
          .where(eq(paymentTransactionsTable.sessionId, s.id));
      } else if (event.type === "checkout.session.async_payment_failed") {
        const s = event.data.object as Stripe.Checkout.Session;
        await db
          .update(paymentTransactionsTable)
          .set({ status: "failed", paymentStatus: "failed" })
          .where(eq(paymentTransactionsTable.sessionId, s.id));
      } else if (event.type === "account.updated") {
        const account = event.data.object as Stripe.Account;
        const userId = Number(account.metadata?.userId);
        if (Number.isInteger(userId)) {
          const onboarded =
            account.details_submitted === true &&
            account.charges_enabled === true;
          await db
            .update(usersTable)
            .set({ stripeConnectOnboarded: onboarded })
            .where(eq(usersTable.id, userId));
        }
      }
    } catch (err) {
      logger.error({ err, eventType: event.type }, "Webhook handler error");
    }

    res.json({ received: true });
  },
);

export default router;
