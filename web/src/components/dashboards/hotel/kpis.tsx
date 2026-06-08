import { KpiCard } from "@/components/dashboards/shared/kpi-card";

export function HotelKpis() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Today's Check-in"  value="200"       />
      <KpiCard label="Today Check-out"   value="34"        />
      <KpiCard label="Total Guests"      value="3,432"     delta="+4.6%" trend="up" />
      <KpiCard label="Total Amount"      value="$668,726"  delta="+12%"  trend="up" />
    </div>
  );
}
