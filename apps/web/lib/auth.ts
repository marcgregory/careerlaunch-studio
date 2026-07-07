import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { prisma } from "./prisma";

const sessionCookieName = "careerlaunch_session";
const passwordIterations = 210_000;
const passwordKeyLength = 32;
const digest = "sha256";
const sessionMaxAge = 60 * 60 * 24 * 14;

type SessionPayload = {
  userId: string;
  email: string;
  expiresAt: number;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt: Date | null;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, passwordIterations, passwordKeyLength, digest).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex"));
}

export function setUserSession(response: NextResponse, user: AuthUser) {
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    expiresAt: Date.now() + 1000 * sessionMaxAge
  };

  response.cookies.set(sessionCookieName, signSession(payload), getSessionCookieOptions());
}

export function deleteUserSession(response: NextResponse) {
  response.cookies.delete(sessionCookieName);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const rawSession = cookieStore.get(sessionCookieName)?.value;
  const payload = rawSession ? verifySession(rawSession) : null;

  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, emailVerifiedAt: true }
  });

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: Response.json({ error: "Authentication required" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function registerUser(input: { email: string; name?: string; password: string }) {
  const email = normalizeEmail(input.email);
  validateCredentials(email, input.password);
  const { hash, salt } = hashPassword(input.password);

  return prisma.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash: hash,
      passwordSalt: salt
    },
    select: { id: true, email: true, name: true, emailVerifiedAt: true }
  });
}

export async function authenticateUser(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return null;
  }

  return { id: user.id, email: user.email, name: user.name, emailVerifiedAt: user.emailVerifiedAt };
}

function validateCredentials(email: string, password: string) {
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  if (password.length < 8) {
    throw new Error("Use at least 8 characters for your password.");
  }
}

function signSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getAuthSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifySession(value: string): SessionPayload | null {
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;

  const expected = crypto.createHmac("sha256", getAuthSecret()).update(body).digest("base64url");
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId || payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge
  };
}

function getAuthSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production.");
  }
  return "dev-only-careerlaunch-session-secret";
}
