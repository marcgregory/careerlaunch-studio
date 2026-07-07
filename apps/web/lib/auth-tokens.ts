import crypto from "node:crypto";
import { prisma } from "./prisma";

const TOKEN_BYTES = 32;

/**
 * Generate a cryptographically random token (raw — for the email link).
 */
export function generateToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Hash a raw token for safe database storage (SHA-256).
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a single-use, expiring auth token in the database.
 * Only the SHA-256 hash is stored — the raw token is returned for the email.
 *
 * @returns The raw token (send this to the user's email).
 */
export async function createToken(
  userId: string,
  type: "email_verification" | "password_reset",
  ttlMs: number,
): Promise<string> {
  const raw = generateToken();
  const tokenHash = hashToken(raw);

  await prisma.authToken.create({
    data: {
      userId,
      tokenHash,
      type,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });

  return raw;
}

/**
 * Consume a single-use auth token.
 *
 * 1. Hash the raw token
 * 2. Find the matching, unexpired, unused token
 * 3. Mark it used
 * 4. Return the token record (or null)
 */
export async function consumeToken(
  rawToken: string,
  type: "email_verification" | "password_reset",
) {
  const tokenHash = hashToken(rawToken);

  const token = await prisma.authToken.findFirst({
    where: {
      tokenHash,
      type,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!token) return null;

  await prisma.authToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });

  return token;
}
