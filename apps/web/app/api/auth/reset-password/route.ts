import { NextResponse } from "next/server";
import { hashPassword } from "../../../../lib/auth";
import { consumeToken } from "../../../../lib/auth-tokens";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: Request) {
  const formData = await request.formData();
  const rawToken = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return NextResponse.redirect(
      new URL(`/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}&error=weak`, request.url),
      { status: 303 },
    );
  }

  const token = await consumeToken(rawToken, "password_reset");
  if (!token) {
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
