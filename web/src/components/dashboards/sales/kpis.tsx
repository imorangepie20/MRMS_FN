import { KpiCard } from "@/components/dashboards/shared/kpi-card";

export function SalesKpis() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total Balance"
        value="$103,045"
        delta="+3.6%"
        trend="up"
        sublabel="from last month"
      />
      <KpiCard
        label="Total Income"
        value="$78,000"
        delta="+2.5%"
        trend="up"
      />
      <KpiCard
        label="Total Expense"
        value="$15,010"
        delta="-6.0%"
        trend="down"
      />
      <KpiCard
        label="Total Sales Tax"
        value="$9,090"
        delta="+5.0%"
        trend="up"
      />
    </div>
  );
}
