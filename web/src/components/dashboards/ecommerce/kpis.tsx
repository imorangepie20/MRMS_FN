import { KpiCard } from "@/components/dashboards/shared/kpi-card";

export function EcommerceKpis() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Best Seller of the Month"
        value="$15,231.89"
        delta="+65%"
        trend="up"
        sublabel="from last month"
      />
      <KpiCard
        label="Monthly Recurring Revenue"
        value="$34.1K"
        delta="+6.1%"
        trend="up"
      />
      <KpiCard
        label="Users"
        value="500.1K"
        delta="+19.2%"
        trend="up"
      />
      <KpiCard
        label="User Growth"
        value="11.3%"
        delta="-1.2%"
        trend="down"
      />
    </div>
  );
}
