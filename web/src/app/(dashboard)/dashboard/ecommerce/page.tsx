import { EcommerceKpis } from "@/components/dashboards/ecommerce/kpis";
import {
  TotalRevenueCard,
  SalesByLocationCard,
  StoreVisitsCard,
} from "@/components/dashboards/ecommerce/charts";
import { CustomerReviewsCard } from "@/components/dashboards/ecommerce/reviews";
import { RecentOrdersCard, BestSellingProductsCard } from "@/components/dashboards/ecommerce/tables";

export default function EcommercePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">E-commerce</h1>

      {/* KPI Row */}
      <EcommerceKpis />

      {/* Charts & cards grid */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Total Revenue — spans 2 cols on xl */}
        <TotalRevenueCard />
        {/* Sales by Location */}
        <SalesByLocationCard />
        {/* Store Visits by Source */}
        <StoreVisitsCard />
        {/* Customer Reviews */}
        <CustomerReviewsCard />
      </div>

      {/* Tables row */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Recent Orders — wider */}
        <div className="xl:col-span-2">
          <RecentOrdersCard />
        </div>
        {/* Best Selling Products */}
        <BestSellingProductsCard />
      </div>
    </div>
  );
}
