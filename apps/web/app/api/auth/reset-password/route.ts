import { NextResponse } from "next/server";
import { hashPassword } from "../../../../lib/auth";
import { consumeToken } from "../../../../lib/auth-tokens";
import { prisma } from "../../../../lib/prisma";

function isJsonRequest(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").includes("application/json");
}

async function parseBody(request: Request): Promise<{ token: string; email: string; password: string }> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const json = await request.json();
    return { token: String(json.token ?? ""), email: String(json.email ?? "").toLowerCase().trim(), password: String(json.password ?? "") };
  }
  const formData = await request.formData();
  return { token: String(formData.get("token") ?? ""), email: String(formData.get("email") ?? "").toLowerCase().trim(), password: String(formData.get("password") ?? "") };
}

export async function POST(request: Request) {
  const { token: rawToken, email, password } = await parseBody(request);

  if (password.length < 8) {
    if (isJsonRequest(request)) {
      return NextResponse.json({ error: "weak", message: "Password must be at least 8 characters." }, { status: 400 });
    }
    return NextResponse.redirect(
      new URL(`/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}&error=weak`, request.url),
      { status: 303 },
    );
  }

  const token = await consumeToken(rawToken, "password_reset");
  if (!token) {
    if (isJsonRequest(request)) {
      return NextResponse.json({ error: "invalid", message: "This reset link is invalid, expired, or already used." }, { status: 400 });
    }
    return NextResponse.redirect(
      new URL(`/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}&error=invalid`, request.url),
      { status: 303 },
    );
  }

  const { hash, salt } = hashPassword(password);

  await prisma.user.update({
    where: { id: token.userId },
    data: { passwordHash: hash, passwordSalt: salt },
  });

  return NextResponse.redirect(new URL("/login?reset=success", request.url), { status: 303 });
}
