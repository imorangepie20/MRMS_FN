import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { getServerSideUser } from "@/lib/server/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSideUser(); // 미로그인이면 내부에서 /login redirect
  if (!user.primary_platform) redirect("/connect");
  return <DashboardShell>{children}</DashboardShell>;
}
