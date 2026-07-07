import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { createToken } from "../../../../lib/auth-tokens";
import { sendVerificationEmail } from "../../../../lib/email";
import { prisma } from "../../../../lib/prisma";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (user.emailVerifiedAt) {
    return NextResponse.json({ error: "Email already verified" }, { status: 400 });
  }

  const rl = checkRateLimit(`verify:email:${user.email}`, 1, 120 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in 2 minutes." }, { status: 429 });
  }

  // Mark any existing unused verification tokens as used
  await prisma.authToken.updateMany({
    where: {
      userId: user.id,
      type: "email_verification",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });

  const rawToken = await createToken(user.id, "email_verification", 24 * 60 * 60 * 1000);
  const result = await sendVerificationEmail(user.email, user.name, rawToken);

  if (result.sent) {
    return NextResponse.json({ sent: true });
  }

  return NextResponse.json({ error: result.reason }, { status: 500 });
}
