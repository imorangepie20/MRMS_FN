import { KpiCard } from "@/components/dashboards/shared/kpi-card";

export function RealEstateKpis() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Active Leads"
        value="120"
        delta="+12%"
        trend="up"
      />
      <KpiCard
        label="Total Revenue"
        value="$96.7M"
        delta="+12%"
        trend="up"
      />
      <KpiCard
        label="Active Listing"
        value="23"
        delta="-12%"
        trend="down"
      />
      <KpiCard
        label="Total Closed"
        value="42"
        delta="+12%"
        trend="up"
      />
    </div>
  );
}
