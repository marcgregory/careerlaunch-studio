import type { ReactNode } from "react";
import { requireUser } from "../../lib/auth";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}
