import { NextResponse } from "next/server";
import { authenticateUser, setUserSession } from "../../../../lib/auth";
import { checkRateLimit } from "../../../../lib/rate-limit";

function getClientIp(request: Request): string {
  const via = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return via || request.headers.get("x-real-ip") || "unknown";
}

async function parseBody(request: Request): Promise<{ email: string; password: string }> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const json = await request.json();
    return { email: String(json.email ?? "").toLowerCase().trim(), password: String(json.password ?? "") };
  }
  const formData = await request.formData();
  return { email: String(formData.get("email") ?? "").toLowerCase().trim(), password: String(formData.get("password") ?? "") };
}

function isJsonRequest(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").includes("application/json");
}

export async function POST(request: Request) {
  const { email, password } = await parseBody(request);
  const ip = getClientIp(request);

  const ipLimit = checkRateLimit(`login:ip:${ip}`, 10, 60 * 1000);
  if (!ipLimit.allowed) {
    if (isJsonRequest(request)) {
      return NextResponse.json({ error: "ratelimited", message: "Too many login attempts. Please wait before trying again." }, { status: 429 });
    }
    return NextResponse.redirect(new URL("/login?error=ratelimited", request.url), { status: 429 });
  }

  const emailLimit = checkRateLimit(`login:email:${email}`, 5, 900 * 1000);
  if (!emailLimit.allowed) {
    if (isJsonRequest(request)) {
      return NextResponse.json({ error: "ratelimited", message: "Too many login attempts. Please wait before trying again." }, { status: 429 });
    }
    return NextResponse.redirect(new URL("/login?error=ratelimited", request.url), { status: 429 });
  }

  const user = await authenticateUser(email, password);

  if (!user) {
    if (isJsonRequest(request)) {
      return NextResponse.json({ error: "invalid", message: "Email or password did not match." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?error=invalid", request.url), { status: 303 });
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
  setUserSession(response, user);
  return response;
}
