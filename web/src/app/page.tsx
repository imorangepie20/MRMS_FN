import { getServerSideUserOptional } from "@/lib/server/auth";
import { HomeMarketing } from "@/components/landing/HomeMarketing";
import { HomeLoggedIn } from "@/components/landing/HomeLoggedIn";

export default async function RootPage() {
  const user = await getServerSideUserOptional();
  if (!user) return <HomeMarketing />;
  return <HomeLoggedIn user={user} />;
}
