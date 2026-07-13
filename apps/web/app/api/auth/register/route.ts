import {
  PrismaClientKnownRequestError,
} from "@prisma/client/runtime/library";
import { NextResponse } from "next/server";
import { registerUser, setUserSession } from "../../../../lib/auth";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { createToken } from "../../../../lib/auth-tokens";
import { sendVerificationEmail } from "../../../../lib/email";

function getClientIp(request: Request): string {
  const via = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return via || request.headers.get("x-real-ip") || "unknown";
}

function isJsonRequest(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").includes("application/json");
}

async function parseBody(request: Request): Promise<{ email: string; name: string; password: string }> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const json = await request.json();
    return { email: String(json.email ?? ""), name: String(json.name ?? ""), password: String(json.password ?? "") };
  }
  const formData = await request.formData();
  return { email: String(formData.get("email") ?? ""), name: String(formData.get("name") ?? ""), password: String(formData.get("password") ?? "") };
}

export async function POST(request: Request) {
  const { email, name, password } = await parseBody(request);
  const ip = getClientIp(request);

  const ipLimit = checkRateLimit(`register:ip:${ip}`, 300, 3600 * 1000);
  const emailLimit = checkRateLimit(`register:email:${email.toLowerCase()}`, 3, 3600 * 1000);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    if (isJsonRequest(request)) {
      return NextResponse.json({ error: "ratelimited", message: "Too many registration attempts. Please wait before trying again." }, { status: 429 });
    }
    return NextResponse.redirect(new URL("/register?error=ratelimited", request.url), { status: 429 });
  }

  try {
    const user = await registerUser({ email, name, password });

    const rawToken = await createToken(user.id, "email_verification", 24 * 60 * 60 * 1000);
    await sendVerificationEmail(user.email, user.name, rawToken);

    const response = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
    setUserSession(response, user);
    return response;
  } catch (error) {
    const code = getRegisterErrorCode(error);
    if (code === "database") console.error("Registration failed because the database is unavailable", error);
    if (isJsonRequest(request)) {
      const messages: Record<string, string> = {
        exists: "An account already exists for that email.",
        invalid: "Use a valid email and a password with at least 8 characters.",
        database: "Database is not configured yet.",
        ratelimited: "Too many registration attempts. Please wait before trying again.",
      };
      return NextResponse.json({ error: code, message: messages[code] || "Registration failed." }, { status: 400 });
    }
    return NextResponse.redirect(new URL(`/register?error=${code}`, request.url), { status: 303 });
  }
}

function getRegisterErrorCode(error: unknown) {
  if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") return "exists";
  if (error instanceof Error && (error.message.includes("database") || error.message.includes("DATABASE_URL") || error.message.includes("Can"))) return "database";
  return "invalid";
}
