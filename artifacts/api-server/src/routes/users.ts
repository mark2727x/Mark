import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, usersTable, shiftsTable } from "@workspace/db";
import { UpdateMeBody as UserUpdate } from "@workspace/api-zod";
import { requireAuth, sanitizeUser } from "./auth";

const router: IRouter = Router();

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
