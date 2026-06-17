import { redirect } from "next/navigation";

import { AdminUsersClient } from "@/components/admin/AdminUsersClient";
import { getServerSideUser } from "@/lib/server/auth";

export default async function AdminUsersPage() {
  const user = await getServerSideUser();
  if (user.role !== "superadmin") redirect("/admin/emp");
  return <AdminUsersClient />;
}
