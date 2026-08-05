import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
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

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function signSession(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

function makeToken(userId: number): string {
  // Signed, persistent session token. Unlike the old in-memory token map,
  // this remains valid when the API workflow is rebuilt or restarted.
  const payload = `${userId}.${Math.floor(Date.now() / 1000)}.${randomBytes(16).toString("base64url")}`;
  return `${Buffer.from(payload).toString("base64url")}.${signSession(payload)}`;
}

function makeVerificationCode(): string {
  return String(randomInt(100000, 1000000));
}

function verificationExpiry(): Date {
  return new Date(Date.now() + 15 * 60 * 1000);
}

function issueAuth(user: any) {
  return { token: makeToken(user.id), user: sanitizeUser(user) };
}

export function getUserIdFromToken(token: string): number | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  try {
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const expected = signSession(payload);
    const actualBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expected);
    if (
      actualBytes.length !== expectedBytes.length ||
      !timingSafeEqual(actualBytes, expectedBytes)
    ) {
      return null;
    }

    const [userIdRaw, issuedAtRaw] = payload.split(".");
    const userId = Number(userIdRaw);
    const issuedAt = Number(issuedAtRaw);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(userId) || !Number.isFinite(issuedAt)) return null;
    if (issuedAt > now + 60 || now - issuedAt > SESSION_TTL_SECONDS) return null;
    return userId;
  } catch {
    return null;
  }
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
  const verificationCode = makeVerificationCode();
  const [user] = await db.insert(usersTable).values({
    email,
    passwordHash,
    name,
    role,
    certifications: certifications ?? null,
    zelleId: zelleId ?? null,
    bio: bio ?? null,
    emailVerified: false,
    emailVerificationCode: verificationCode,
    emailVerificationExpiresAt: verificationExpiry(),
  }).returning();

  // Resend was not connected for this project. In development, return the
  // code so registration remains testable without silently claiming an email
  // was delivered. A mail integration can replace this response later.
  res.status(201).json({
    verificationRequired: true,
    email: user.email,
    verificationCode: process.env.NODE_ENV === "production" ? undefined : verificationCode,
  });
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

  if (!user.emailVerified) {
    res.status(403).json({
      error: "Email verification required",
      verificationRequired: true,
      email: user.email,
    });
    return;
  }

  res.json(issueAuth(user));
});

router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Enter the email and 6-digit verification code" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(400).json({ error: "Invalid verification code" });
    return;
  }
  if (user.emailVerified) {
    res.json(issueAuth(user));
    return;
  }
  if (
    !user.emailVerificationCode ||
    user.emailVerificationCode !== code ||
    !user.emailVerificationExpiresAt ||
    user.emailVerificationExpiresAt.getTime() < Date.now()
  ) {
    res.status(400).json({ error: "Invalid or expired verification code" });
    return;
  }

  const [verified] = await db.update(usersTable)
    .set({
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationExpiresAt: null,
    })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json(issueAuth(verified));
});

router.post("/auth/resend-verification", async (req, res): Promise<void> => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(200).json({ verificationRequired: true, email });
    return;
  }
  if (user.emailVerified) {
    res.json({ verificationRequired: false });
    return;
  }

  const verificationCode = makeVerificationCode();
  await db.update(usersTable)
    .set({
      emailVerificationCode: verificationCode,
      emailVerificationExpiresAt: verificationExpiry(),
    })
    .where(eq(usersTable.id, user.id));

  res.json({
    verificationRequired: true,
    email,
    verificationCode: process.env.NODE_ENV === "production" ? undefined : verificationCode,
  });
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
