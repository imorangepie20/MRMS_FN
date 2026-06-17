import { redirect } from "next/navigation";

import { getServerSideUserOptional } from "@/lib/server/auth";
import { HomeMarketing } from "@/components/landing/HomeMarketing";
import { HomeLoggedIn } from "@/components/landing/HomeLoggedIn";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function RootPage() {
  const user = await getServerSideUserOptional();
  if (!user) return <HomeMarketing />;
  if (!user.primary_platform) redirect("/connect");
  return (
    <DashboardShell>
      <HomeLoggedIn user={user} />
    </DashboardShell>
  );
}
