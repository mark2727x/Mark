import { Router, type IRouter } from "express";
import { eq, or, desc } from "drizzle-orm";
import { db, usersTable, shiftsTable } from "@workspace/db";
import { UpdateMeBody as UserUpdate } from "@workspace/api-zod";
import { requireAuth, sanitizeUser } from "./auth";

const router: IRouter = Router();

// Platform fee split kept in sync with payments.ts:
// 1.5% surcharge to the manager on top of the base + 1.5% deducted from the
// lifeguard's payout = 3% total to the business. Stripe processing fees are
// deducted from the platform balance by Stripe itself.
const MANAGER_FEE_BPS = 150;
const LIFEGUARD_FEE_BPS = 150;
const PLATFORM_FEE_BPS = MANAGER_FEE_BPS + LIFEGUARD_FEE_BPS;

router.get("/users/me/earnings", requireAuth, async (req: any, res): Promise<void> => {
  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
  if (!me) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (me.role !== "lifeguard") {
    res.status(403).json({ error: "Only lifeguards have earnings" });
    return;
  }

  const shifts = await db
    .select()
    .from(shiftsTable)
    .where(eq(shiftsTable.workerId, me.id))
    .orderBy(desc(shiftsTable.startTime));

  let pendingCents = 0;
  let paidCents = 0;
  let paidOutCents = 0;

  const lineItems = shifts.map((shift) => {
    const gross = Math.round(shift.payRate * shift.totalHours * 100);
    const fee = Math.round((gross * LIFEGUARD_FEE_BPS) / 10000);
    const net = gross - fee;

    if (shift.status === "cancelled") {
      // no earnings
    } else if (shift.paymentStatus === "paid_out") {
      paidOutCents += net;
    } else if (shift.paymentStatus === "paid") {
      paidCents += net;
    } else if (shift.status === "filled" || shift.status === "completed") {
      pendingCents += net;
    }

    return {
      shiftId: shift.id,
      title: shift.title,
      startTime: shift.startTime,
      status: shift.status,
      paymentStatus: shift.paymentStatus,
      grossCents: gross,
      platformFeeCents: fee,
      netCents: net,
    };
  });

  res.json({
    connectOnboarded: me.stripeConnectOnboarded,
    platformFeeBps: PLATFORM_FEE_BPS,
    lifeguardFeeBps: LIFEGUARD_FEE_BPS,
    managerFeeBps: MANAGER_FEE_BPS,
    totals: {
      pendingCents,
      paidCents,
      paidOutCents,
      lifetimeCents: paidCents + paidOutCents,
    },
    shifts: lineItems,
  });
});

router.get("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(sanitizeUser(user, { includePhone: true }));
});

router.patch("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = UserUpdate.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.phone !== undefined && parsed.data.phone.replace(/\D/g, "").length < 10) {
    res.status(400).json({ error: "Enter a valid 10-digit phone number" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, req.userId))
    .returning();
  res.json(sanitizeUser(updated));
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(sanitizeUser(user));
});

router.get("/users/:id/shifts", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const shifts = user.role === "manager"
    ? await db.select().from(shiftsTable).where(eq(shiftsTable.managerId, id))
    : await db.select().from(shiftsTable).where(eq(shiftsTable.workerId, id));

  res.json(shifts);
});

export default router;
