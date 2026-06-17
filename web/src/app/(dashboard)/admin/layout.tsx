import { redirect } from "next/navigation";

import { getServerSideUser } from "@/lib/server/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSideUser(); // 미로그인 시 내부에서 /login redirect
  if (user.role !== "admin" && user.role !== "superadmin") redirect("/");
  return <>{children}</>;
}
