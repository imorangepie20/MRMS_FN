import { AuthCard } from "@/components/auth/auth-card";
import { PlatformConnect } from "@/components/auth/PlatformConnect";

export default function ConnectPage() {
  return (
    <AuthCard
      title="음악 플랫폼 연결"
      description="추천과 재생을 위해 스트리밍 플랫폼을 1개 이상 연결하세요."
    >
      <PlatformConnect next="/onboarding" />
    </AuthCard>
  );
}
