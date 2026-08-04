import { Router, type IRouter } from "express";
import { eq, and, ilike, gte } from "drizzle-orm";
import { db, shiftsTable, usersTable, ratingsTable } from "@workspace/db";
import { CreateShiftBody as ShiftInput, UpdateShiftBody as ShiftUpdate } from "@workspace/api-zod";
import { requireAuth, sanitizeUser } from "./auth";

const router: IRouter = Router();

async function enrichShift(shift: any) {
  const [manager] = await db.select().from(usersTable).where(eq(usersTable.id, shift.managerId)).limit(1);
  let worker = null;
  if (shift.workerId) {
    const [w] = await db.select().from(usersTable).where(eq(usersTable.id, shift.workerId)).limit(1);
    worker = w ? sanitizeUser(w) : null;
  }
  return { ...shift, manager: manager ? sanitizeUser(manager) : null, worker };
}

router.get("/shifts", async (req, res): Promise<void> => {
  const { certification, status = "open", location } = req.query as Record<string, string>;

  let query = db.select().from(shiftsTable).$dynamic();

  const conditions = [];
  if (status) conditions.push(eq(shiftsTable.status, status as any));
  if (certification) conditions.push(ilike(shiftsTable.certificationRequired, `%${certification}%`));
  if (location) conditions.push(ilike(shiftsTable.location, `%${location}%`));

  if (conditions.length > 0) query = query.where(and(...conditions));

  const shifts = await query.orderBy(shiftsTable.startTime);
  const enriched = await Promise.all(shifts.map(enrichShift));
  res.json(enriched);
});

router.post("/shifts", requireAuth, async (req: any, res): Promise<void> => {
  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
  if (!me || me.role !== "manager") {
    res.status(403).json({ error: "Only pool managers can post shifts" });
    return;
  }

  const parsed = ShiftInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [shift] = await db.insert(shiftsTable).values({
    ...parsed.data,
    startTime: new Date(parsed.data.startTime),
    managerId: req.userId,
  }).returning();

  res.status(201).json(await enrichShift(shift));
});

router.get("/shifts/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  if (!shift) {
    res.status(404).json({ error: "Shift not found" });
    return;
  }
  res.json(await enrichShift(shift));
});

router.patch("/shifts/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  if (!shift) { res.status(404).json({ error: "Shift not found" }); return; }
  if (shift.managerId !== req.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (shift.status !== "open") { res.status(400).json({ error: "Can only edit open shifts" }); return; }

  const parsed = ShiftUpdate.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: any = { ...parsed.data };
  if (updateData.startTime) updateData.startTime = new Date(updateData.startTime);

  const [updated] = await db.update(shiftsTable).set(updateData).where(eq(shiftsTable.id, id)).returning();
  res.json(await enrichShift(updated));
});

router.delete("/shifts/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  if (!shift) { res.status(404).json({ error: "Shift not found" }); return; }
  if (shift.managerId !== req.userId) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.update(shiftsTable).set({ status: "cancelled" }).where(eq(shiftsTable.id, id));
  res.sendStatus(204);
});

router.post("/shifts/:id/pickup", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
  if (!me || me.role !== "lifeguard") {
    res.status(403).json({ error: "Only lifeguards can pick up shifts" });
    return;
  }

  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  if (!shift) { res.status(404).json({ error: "Shift not found" }); return; }
  if (shift.status !== "open") { res.status(400).json({ error: "Shift is not available" }); return; }

  const [updated] = await db.update(shiftsTable)
    .set({ status: "filled", workerId: req.userId })
    .where(eq(shiftsTable.id, id))
    .returning();
  res.json(await enrichShift(updated));
});

router.post("/shifts/:id/drop", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  if (!shift) { res.status(404).json({ error: "Shift not found" }); return; }
  if (shift.workerId !== req.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (shift.status !== "filled") { res.status(400).json({ error: "Shift is not in filled status" }); return; }

  const [updated] = await db.update(shiftsTable)
    .set({ status: "open", workerId: null })
    .where(eq(shiftsTable.id, id))
    .returning();
  res.json(await enrichShift(updated));
});

router.post("/shifts/:id/complete", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  if (!shift) { res.status(404).json({ error: "Shift not found" }); return; }
  if (shift.managerId !== req.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (shift.status !== "filled") { res.status(400).json({ error: "Shift must be filled to complete" }); return; }

  const [updated] = await db.update(shiftsTable)
    .set({ status: "completed" })
    .where(eq(shiftsTable.id, id))
    .returning();
  res.json(await enrichShift(updated));
});

export default router;
