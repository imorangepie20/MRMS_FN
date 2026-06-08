import { SalesKpis } from "@/components/dashboards/sales/kpis";
import { RevenueCard } from "@/components/dashboards/sales/charts";
import {
  BestSellingProductCard,
  TrackOrderStatusCard,
  OrderTableCard,
} from "@/components/dashboards/sales/widgets";

export default function SalesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>

      {/* KPI Row */}
      <SalesKpis />

      {/* Revenue + Best Selling Product */}
      <div className="grid gap-4 lg:grid-cols-3">
        <RevenueCard />
        <BestSellingProductCard />
      </div>

      {/* Track Order Status */}
      <TrackOrderStatusCard />

      {/* Order Table */}
      <OrderTableCard />
    </div>
  );
}
