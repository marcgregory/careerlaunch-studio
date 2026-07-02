import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { registerUser, setUserSession } from "../../../../lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();

  try {
    const user = await registerUser({
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? "")
    });

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
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "exists";
  if (error instanceof Prisma.PrismaClientInitializationError) return "database";
  if (error instanceof Prisma.PrismaClientRustPanicError) return "database";
  if (error instanceof Error && error.message.includes("DATABASE_URL")) return "database";
  if (error instanceof Error && error.message.includes("Can't reach database")) return "database";
  return "invalid";
}
