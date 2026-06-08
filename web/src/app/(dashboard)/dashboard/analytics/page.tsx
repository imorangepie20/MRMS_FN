import { KpiCard } from "@/components/dashboards/shared/kpi-card";
import { TrafficOverviewCard, TrafficSourcesCard } from "@/components/dashboards/analytics/charts";
import {
  SupportCard,
  SalesSnapshotCard,
  SalesByCountriesCard,
  MonthlyCampaignCard,
} from "@/components/dashboards/analytics/widgets";

export default function WebsiteAnalyticsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Website Analytics</h1>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Daily Active Users"
          value="3,450"
          delta="+12.1%"
          trend="up"
        />
        <KpiCard
          label="Weekly Sessions"
          value="1,342"
          delta="-9.8%"
          trend="down"
        />
        <KpiCard
          label="Duration"
          value="5.2min"
          delta="+7.7%"
          trend="up"
        />
        <KpiCard
          label="Conversion Rate"
          value="2.8%"
          delta="+4.3%"
          trend="up"
        />
      </div>

      {/* Traffic Overview + Traffic Sources */}
      <div className="grid gap-4 lg:grid-cols-3">
        <TrafficOverviewCard />
        <TrafficSourcesCard />
      </div>

      {/* Support + Sales Snapshot */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SupportCard />
        <SalesSnapshotCard />
      </div>

      {/* Sales by Countries + Monthly Campaign State */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SalesByCountriesCard />
        <MonthlyCampaignCard />
      </div>
    </div>
  );
}
