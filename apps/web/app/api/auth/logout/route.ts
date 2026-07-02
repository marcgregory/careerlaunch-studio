import { NextResponse } from "next/server";
import { deleteUserSession } from "../../../../lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  deleteUserSession(response);
  return response;
}
