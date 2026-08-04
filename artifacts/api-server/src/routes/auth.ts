import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { db, usersTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

// Simple password hashing (SHA-256 + salt stored in hash)
function hashPassword(password: string, salt?: string): string {
  const s = salt ?? randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(s + password).digest("hex");
  return `${s}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const expected = createHash("sha256").update(salt + password).digest("hex");
  return expected === hash;
}

function makeToken(userId: number): string {
  // Simple non-expiring token: base64(userId + random)
  return Buffer.from(`${userId}:${randomBytes(32).toString("hex")}`).toString("base64");
}

// Token store: in production use Redis/DB. For now, in-memory (resets on restart).
const tokenStore = new Map<string, number>();

export function getUserIdFromToken(token: string): number | null {
  return tokenStore.get(token) ?? null;
}

export function requireAuth(req: any, res: any, next: any): void {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = getUserIdFromToken(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.userId = userId;
  next();
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, name, role, certifications, zelleId, bio } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    email,
    passwordHash,
    name,
    role,
    certifications: certifications ?? null,
    zelleId: zelleId ?? null,
    bio: bio ?? null,
  }).returning();

  const token = makeToken(user.id);
  tokenStore.set(token, user.id);

  res.status(201).json({ token, user: sanitizeUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = makeToken(user.id);
  tokenStore.set(token, user.id);

  res.json({ token, user: sanitizeUser(user) });
});

router.get("/auth/me", requireAuth, async (req: any, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(sanitizeUser(user));
});

export function sanitizeUser(user: any) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

export default router;
