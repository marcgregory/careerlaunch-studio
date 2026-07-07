import { NextResponse } from "next/server";
import { consumeToken } from "../../../../lib/auth-tokens";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawToken = searchParams.get("token");

  if (!rawToken) {
    return NextResponse.redirect(new URL("/verify-email?error=invalid", request.url), { status: 303 });
  }

  const token = await consumeToken(rawToken, "email_verification");
  if (!token) {
    return NextResponse.redirect(new URL("/verify-email?error=invalid", request.url), { status: 303 });
  }

  await prisma.user.update({
    where: { id: token.userId },
    data: { emailVerifiedAt: new Date() },
  });

  return NextResponse.redirect(new URL("/verify-email?success=true", request.url), { status: 303 });
}
