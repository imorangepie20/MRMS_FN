import { RealEstateKpis } from "@/components/dashboards/real-estate/kpis";
import { RevenueVisitCard, SalesAnalyticsCard, PropertyOverviewCard } from "@/components/dashboards/real-estate/charts";
import {
  FeaturedPropertyCard,
  OnProgressDealsCard,
  RemindersCard,
  LeadsContactCard,
  ActiveListingCard,
  CalendarCard,
} from "@/components/dashboards/real-estate/widgets";

export default function RealEstatePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Real Estate</h1>

      {/* KPI Row */}
      <RealEstateKpis />

      {/* Revenue/Visit (wider) + Featured Property */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueVisitCard />
        </div>
        <FeaturedPropertyCard />
      </div>

      {/* On Progress Deals + Reminders + Leads Contact */}
      <div className="grid gap-4 lg:grid-cols-3">
        <OnProgressDealsCard />
        <RemindersCard />
        <LeadsContactCard />
      </div>

      {/* Sales Analytics + Property Overview */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SalesAnalyticsCard />
        <PropertyOverviewCard />
      </div>

      {/* Active Listing (wider) + Calendar */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActiveListingCard />
        </div>
        <CalendarCard />
      </div>
    </div>
  );
}
