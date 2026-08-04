import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ratingsTable, usersTable, shiftsTable } from "@workspace/db";
import { CreateRatingBody as RatingInput } from "@workspace/api-zod";
import { requireAuth, sanitizeUser } from "./auth";

const router: IRouter = Router();

router.post("/ratings", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = RatingInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rateeId, shiftId, score, comment } = parsed.data;

  // Check shift exists and is completed
  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, shiftId)).limit(1);
  if (!shift || shift.status !== "completed") {
    res.status(400).json({ error: "Can only rate completed shifts" });
    return;
  }

  // Check rater was part of the shift
  const isManager = shift.managerId === req.userId;
  const isWorker = shift.workerId === req.userId;
  if (!isManager && !isWorker) {
    res.status(403).json({ error: "You were not part of this shift" });
    return;
  }

  // Check not already rated
  const existing = await db.select().from(ratingsTable)
    .where(and(eq(ratingsTable.shiftId, shiftId), eq(ratingsTable.raterId, req.userId)))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "You already rated this shift" });
    return;
  }

  const [rating] = await db.insert(ratingsTable).values({
    raterId: req.userId,
    rateeId,
    shiftId,
    score,
    comment: comment ?? null,
  }).returning();

  // Update ratee's avg rating
  const allRatings = await db.select().from(ratingsTable).where(eq(ratingsTable.rateeId, rateeId));
  const avg = allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length;
  await db.update(usersTable).set({
    ratingAvg: Math.round(avg * 10) / 10,
    ratingCount: allRatings.length,
  }).where(eq(usersTable.id, rateeId));

  const [rater] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
  const [ratee] = await db.select().from(usersTable).where(eq(usersTable.id, rateeId)).limit(1);

  res.status(201).json({
    ...rating,
    rater: rater ? sanitizeUser(rater) : null,
    ratee: ratee ? sanitizeUser(ratee) : null,
  });
});

router.get("/users/:id/ratings", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const ratings = await db.select().from(ratingsTable).where(eq(ratingsTable.rateeId, id));

  const enriched = await Promise.all(ratings.map(async (r) => {
    const [rater] = await db.select().from(usersTable).where(eq(usersTable.id, r.raterId)).limit(1);
    const [ratee] = await db.select().from(usersTable).where(eq(usersTable.id, r.rateeId)).limit(1);
    return { ...r, rater: rater ? sanitizeUser(rater) : null, ratee: ratee ? sanitizeUser(ratee) : null };
  }));

  res.json(enriched);
});

export default router;
