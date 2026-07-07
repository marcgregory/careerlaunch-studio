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

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const ip = getClientIp(request);

  const rl = checkRateLimit(`register:ip:${ip}`, 3, 3600 * 1000);
  if (!rl.allowed) {
    return NextResponse.redirect(new URL("/register?error=ratelimited", request.url), { status: 429 });
  }

  try {
    const user = await registerUser({
      email,
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? "")
    });

    const rawToken = await createToken(user.id, "email_verification", 24 * 60 * 60 * 1000);
    await sendVerificationEmail(user.email, user.name, rawToken);

    const response = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
    setUserSession(response, user);
    return response;
  } catch (error) {
    const code = getRegisterErrorCode(error);
    if (code === "database") console.error("Registration failed because the database is unavailable", error);
    return NextResponse.redirect(new URL(`/register?error=${code}`, request.url), { status: 303 });
  }
}

function getRegisterErrorCode(error: unknown) {
  if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") return "exists";
  if (error instanceof Error && (error.message.includes("database") || error.message.includes("DATABASE_URL") || error.message.includes("Can"))) return "database";
  return "invalid";
}
