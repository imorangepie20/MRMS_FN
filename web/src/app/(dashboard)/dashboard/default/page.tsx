import { DashboardHeader } from "@/components/dashboards/default/dashboard-header";
import { SubscriptionsCard, TotalRevenueCard } from "@/components/dashboards/default/metric-cards";
import { TeamMembersCard } from "@/components/dashboards/default/team-members";
import { ChatCard } from "@/components/dashboards/default/chat-card";
import { ExerciseCard } from "@/components/dashboards/default/exercise-card";
import { PaymentsTable } from "@/components/dashboards/default/payments-table";
import { PaymentMethodCard } from "@/components/dashboards/default/payment-method";

export default function DefaultDashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <DashboardHeader />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <SubscriptionsCard />
        <TotalRevenueCard />
        <TeamMembersCard />
        <ChatCard />
        <ExerciseCard />
        <PaymentMethodCard />
        <div className="lg:col-span-2 xl:col-span-3">
          <PaymentsTable />
        </div>
      </div>
    </div>
  );
}
