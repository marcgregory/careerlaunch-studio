import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";

export default async function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return children;
}
