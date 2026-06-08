import { KpiCard } from "@/components/dashboards/shared/kpi-card";

export function CrmKpis() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <KpiCard
        label="Total Customers"
        value="1890"
        delta="+10.4%"
        trend="up"
        sublabel="from last month"
      />
      <KpiCard
        label="Total Deals"
        value="1,300"
        delta="-0.8%"
        trend="down"
      />
      <KpiCard
        label="Total Revenue"
        value="$435,578"
        delta="+20.1%"
        trend="up"
      />
    </div>
  );
}
