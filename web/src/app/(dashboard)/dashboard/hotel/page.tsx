import { HotelKpis } from "@/components/dashboards/hotel/kpis";
import {
  TotalSalesCard,
  RevenueCard,
  ReservationsCard,
  CampaignOverviewCard,
  RecentActivitiesCard,
  BookingListCard,
} from "@/components/dashboards/hotel/widgets";
import {
  BookingsCard,
  OnlineOfflineCard,
} from "@/components/dashboards/hotel/charts";

export default function HotelPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Hotel</h1>

      {/* KPI Row */}
      <HotelKpis />

      {/* Total Sales / Revenue / Reservations / Campaign Overview */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TotalSalesCard />
        <RevenueCard />
        <ReservationsCard />
        <CampaignOverviewCard />
      </div>

      {/* Bookings (wider) + Online vs Offline */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BookingsCard />
        </div>
        <OnlineOfflineCard />
      </div>

      {/* Recent Activities + Booking List */}
      <div className="grid gap-4 lg:grid-cols-3">
        <RecentActivitiesCard />
        <div className="lg:col-span-2">
          <BookingListCard />
        </div>
      </div>
    </div>
  );
}
