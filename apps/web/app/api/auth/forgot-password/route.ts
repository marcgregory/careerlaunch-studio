import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { createToken } from "../../../../lib/auth-tokens";
import { sendPasswordResetEmail } from "../../../../lib/email";
import { prisma } from "../../../../lib/prisma";

function getClientIp(request: Request): string {
  const via = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return via || request.headers.get("x-real-ip") || "unknown";
}

function isJsonRequest(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").includes("application/json");
}

async function parseBody(request: Request): Promise<{ email: string }> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const json = await request.json();
    return { email: String(json.email ?? "").toLowerCase().trim() };
  }
  const formData = await request.formData();
  return { email: String(formData.get("email") ?? "").toLowerCase().trim() };
}

export async function POST(request: Request) {
  const { email } = await parseBody(request);
  const ip = getClientIp(request);

  const perIp = checkRateLimit(`forgot:ip:${ip}`, 3, 3600 * 1000);
  if (!perIp.allowed) {
    if (isJsonRequest(request)) {
      return NextResponse.json({ error: "ratelimited", message: "Too many requests. Please wait before trying again." }, { status: 429 });
    }
    return NextResponse.redirect(new URL("/forgot-password?error=ratelimited", request.url), { status: 429 });
  }

  const perEmail = checkRateLimit(`forgot:email:${email}`, 1, 300 * 1000);
  if (!perEmail.allowed) {
    if (isJsonRequest(request)) {
      return NextResponse.json({ error: "ratelimited", message: "Too many requests. Please wait before trying again." }, { status: 429 });
    }
    return NextResponse.redirect(new URL("/forgot-password?error=ratelimited", request.url), { status: 429 });
  }

  // Always show success — don't reveal whether email exists (no email enumeration)
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user) {
    const rawToken = await createToken(user.id, "password_reset", 60 * 60 * 1000);
    await sendPasswordResetEmail(email, rawToken);
  }

  return NextResponse.redirect(new URL("/forgot-password?sent=true", request.url), { status: 303 });
}
