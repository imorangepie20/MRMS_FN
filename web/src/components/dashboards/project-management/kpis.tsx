import { KpiCard } from "@/components/dashboards/shared/kpi-card";

export function ProjectManagementKpis() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total Revenue"
        value="$45,231.89"
        delta="+20.1%"
        trend="up"
        sublabel="from last month"
      />
      <KpiCard
        label="Active Projects"
        value="1,423"
        delta="+5.02%"
        trend="up"
        sublabel="from last month"
      />
      <KpiCard
        label="New Leads"
        value="3,500"
        delta="-3.58%"
        trend="down"
        sublabel="from last month"
      />
      <KpiCard
        label="Time Spent"
        value="168h 40m"
        delta="-3.58%"
        trend="down"
        sublabel="from last month"
      />
    </div>
  );
}
