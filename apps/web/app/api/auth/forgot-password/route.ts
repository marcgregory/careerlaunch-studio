import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { createToken } from "../../../../lib/auth-tokens";
import { sendPasswordResetEmail } from "../../../../lib/email";
import { prisma } from "../../../../lib/prisma";

function getClientIp(request: Request): string {
  const via = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return via || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const ip = getClientIp(request);

  const perIp = checkRateLimit(`forgot:ip:${ip}`, 3, 3600 * 1000);
  if (!perIp.allowed) {
    return NextResponse.redirect(new URL("/forgot-password?error=ratelimited", request.url), { status: 429 });
  }

  const perEmail = checkRateLimit(`forgot:email:${email}`, 1, 300 * 1000);
  if (!perEmail.allowed) {
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
