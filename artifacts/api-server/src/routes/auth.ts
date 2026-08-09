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

const SESSION_SECRET: string = process.env.SESSION_SECRET ?? "";
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const RED_CROSS_ASSOCIATION = "American Red Cross";
const RED_CROSS_LOOKUP_URL = "https://www.redcross.org/take-a-class/digital-certificate";
const RED_CROSS_SEARCH_URL =
  "https://www.redcross.org/on/demandware.store/Sites-RedCross-Site/default/Certificates-SearchCertificates";

type CertificateDetails = {
  association: string;
  certificateType: string;
  certificateNumber: string;
};

function cleanCertificateDetails(value: any): CertificateDetails | null {
  const association = typeof value?.association === "string" ? value.association.trim() : "";
  const certificateType = typeof value?.certificateType === "string" ? value.certificateType.trim() : "";
  const certificateNumber = typeof value?.certificateNumber === "string"
    ? value.certificateNumber.trim().toUpperCase()
    : "";

  if (!association || !certificateType || !/^[A-Z0-9][A-Z0-9-]{3,63}$/.test(certificateNumber)) {
    return null;
  }
  return { association, certificateType, certificateNumber };
}

async function lookupCertificate(details: CertificateDetails): Promise<{
  verified: boolean;
  verificationUrl: string;
}> {
  if (details.association !== RED_CROSS_ASSOCIATION) {
    throw new Error("That certificate association is not supported yet");
  }

  const verificationUrl =
    `${RED_CROSS_LOOKUP_URL}?certnumber=${encodeURIComponent(details.certificateNumber)}`;
  const searchUrl =
    `${RED_CROSS_SEARCH_URL}?certnumber=${encodeURIComponent(details.certificateNumber)}&format=ajax`;

  try {
    const response = await fetch(searchUrl, {
      headers: { "User-Agent": "ShiftGuard certificate verification/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      throw new Error(`Certificate provider returned ${response.status}`);
    }
    const html = await response.text();
    const notFound =
      /empty-certificate-result|no-certificate-result|Sorry,\s*we did not find a certificate/i.test(html);
    const hasCertificateDetails =
      /certificate-heading-list|eachcertPDF|certificateName|Certificate ID:/i.test(html);
    return { verified: !notFound && hasCertificateDetails, verificationUrl };
  } catch {
    throw new Error("The certificate provider could not be reached. Try again.");
  }
}

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
  return { token: makeToken(user.id), user: sanitizeUser(user, { includePhone: true }) };
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
  if (parsed.data.phone.replace(/\D/g, "").length < 10) {
    res.status(400).json({ error: "Enter a valid 10-digit phone number" });
    return;
  }

  const {
    email, phone, password, name, role, certifications, zelleId, bio,
    certificateAssociation, certificateType, certificateNumber,
  } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  let certificateDetails: CertificateDetails | null = null;
  if (role === "lifeguard") {
    certificateDetails = cleanCertificateDetails({
      association: certificateAssociation,
      certificateType,
      certificateNumber,
    });
    if (!certificateDetails) {
      res.status(400).json({
        error: "Lifeguards must provide a valid certificate association, type, and number",
      });
      return;
    }
    try {
      const result = await lookupCertificate(certificateDetails);
      if (!result.verified) {
        res.status(400).json({
          error: "We could not find that certificate in the American Red Cross lookup",
        });
        return;
      }
    } catch (error: any) {
      res.status(503).json({ error: error.message });
      return;
    }
  }

  const passwordHash = hashPassword(password);
  const verificationCode = makeVerificationCode();
  const [user] = await db.insert(usersTable).values({
    email,
    phone: phone.trim(),
    passwordHash,
    name,
    role,
    certifications: certifications ?? null,
    zelleId: zelleId ?? null,
    bio: bio ?? null,
    emailVerified: false,
    emailVerificationCode: verificationCode,
    emailVerificationExpiresAt: verificationExpiry(),
    certificateAssociation: certificateDetails?.association ?? null,
    certificateType: certificateDetails?.certificateType ?? null,
    certificateNumber: certificateDetails?.certificateNumber ?? null,
    certificateVerifiedAt: certificateDetails ? new Date() : null,
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

router.post("/auth/verify-certificate", async (req, res): Promise<void> => {
  const details = cleanCertificateDetails(req.body);
  if (!details) {
    res.status(400).json({
      error: "Enter the association, certificate type, and certificate number",
    });
    return;
  }

  try {
    const result = await lookupCertificate(details);
    if (!result.verified) {
      res.status(400).json({
        error: "We could not find that certificate in the American Red Cross lookup",
        verified: false,
      });
      return;
    }
    res.json({
      verified: true,
      association: details.association,
      certificateType: details.certificateType,
      certificateNumber: details.certificateNumber,
      verificationUrl: result.verificationUrl,
    });
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
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
  res.json(sanitizeUser(user, { includePhone: true }));
});

export function sanitizeUser(user: any, options: { includePhone?: boolean } = {}) {
  const { passwordHash: _, certificateNumber: __, ...safe } = user;
  if (!options.includePhone) {
    delete safe.phone;
  }
  return safe;
}

export default router;
