import { NextResponse } from "next/server";
import { authenticateUser, setUserSession } from "../../../../lib/auth";
import { checkRateLimit } from "../../../../lib/rate-limit";

function getClientIp(request: Request): string {
  const via = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return via || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const ip = getClientIp(request);

  const ipLimit = checkRateLimit(`login:ip:${ip}`, 10, 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.redirect(new URL("/login?error=ratelimited", request.url), { status: 429 });
  }

  const emailLimit = checkRateLimit(`login:email:${email}`, 5, 900 * 1000);
  if (!emailLimit.allowed) {
    return NextResponse.redirect(new URL("/login?error=ratelimited", request.url), { status: 429 });
  }

  const user = await authenticateUser(email, String(formData.get("password") ?? ""));

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url), { status: 303 });
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
  setUserSession(response, user);
  return response;
}
