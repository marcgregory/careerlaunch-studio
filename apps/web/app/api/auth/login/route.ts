import { NextResponse } from "next/server";
import { authenticateUser, setUserSession } from "../../../../lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const user = await authenticateUser(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url), { status: 303 });
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
  setUserSession(response, user);
  return response;
}
