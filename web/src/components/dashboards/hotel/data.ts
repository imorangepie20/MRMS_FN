// ─── Types ────────────────────────────────────────────────────────────────────

export type BookingDataPoint = {
  label: string;
  bookings: number;
};

export type ReservationStatus = {
  label: string;
  count: number;
  color: string;
};

export type CampaignStat = {
  label: string;
  value: string;
};

export type BookingEntry = {
  id: string;
  guest: string;
  roomType: string;
  roomNumber: string;
  duration: string;
  checkIn: string;
  checkOut: string;
  status: "Confirmed" | "Pending" | "Cancelled" | "Checked In";
};

export type RecentActivity = {
  initials: string;
  name: string;
  room: string;
  minsAgo: number;
};

// ─── Bookings chart (monthly, 12 points) ─────────────────────────────────────

export const bookingsDataMonthly: BookingDataPoint[] = [
  { label: "Jan", bookings: 1320 },
  { label: "Feb", bookings: 1540 },
  { label: "Mar", bookings: 1780 },
  { label: "Apr", bookings: 1650 },
  { label: "May", bookings: 1920 },
  { label: "Jun", bookings: 2100 },
  { label: "Jul", bookings: 2350 },
  { label: "Aug", bookings: 2280 },
  { label: "Sep", bookings: 1980 },
  { label: "Oct", bookings: 1745 },
  { label: "Nov", bookings: 1610 },
  { label: "Dec", bookings: 2112 },
];

export const bookingsDataWeekly: BookingDataPoint[] = [
  { label: "Mon", bookings: 420 },
  { label: "Tue", bookings: 380 },
  { label: "Wed", bookings: 510 },
  { label: "Thu", bookings: 460 },
  { label: "Fri", bookings: 620 },
  { label: "Sat", bookings: 740 },
  { label: "Sun", bookings: 590 },
];

export const bookingsDataDaily: BookingDataPoint[] = [
  { label: "6am",  bookings: 12 },
  { label: "8am",  bookings: 28 },
  { label: "10am", bookings: 45 },
  { label: "12pm", bookings: 62 },
  { label: "2pm",  bookings: 54 },
  { label: "4pm",  bookings: 71 },
  { label: "6pm",  bookings: 88 },
  { label: "8pm",  bookings: 76 },
  { label: "10pm", bookings: 43 },
];

export const bookingsDataYearly: BookingDataPoint[] = [
  { label: "2020", bookings: 14200 },
  { label: "2021", bookings: 16800 },
  { label: "2022", bookings: 18500 },
  { label: "2023", bookings: 17900 },
  { label: "2024", bookings: 19600 },
  { label: "2025", bookings: 20396 },
];

// ─── Reservations ─────────────────────────────────────────────────────────────

export const reservationStatuses: ReservationStatus[] = [
  { label: "Confirmed",   count: 48, color: "bg-emerald-500" },
  { label: "Checked In",  count: 32, color: "bg-blue-500"    },
  { label: "Checked Out", count: 26, color: "bg-slate-400"   },
];

// ─── Campaign Overview ────────────────────────────────────────────────────────

export const campaignStats: CampaignStat[] = [
  { label: "Booked",      value: "290"  },
  { label: "Visited",     value: "638"  },
  { label: "Performance", value: "12+"  },
];

// ─── Online vs Offline ────────────────────────────────────────────────────────

export const onlineOfflineData = [
  { name: "Online",  value: 14839, fill: "var(--chart-1)" },
  { name: "Offline", value: 5556,  fill: "var(--chart-2)" },
];

// ─── Recent Activities ────────────────────────────────────────────────────────

export const recentActivities: RecentActivity[] = [
  { initials: "JD", name: "James Donovan",   room: "Room 204", minsAgo: 16 },
  { initials: "SP", name: "Sofia Petrov",    room: "Room 118", minsAgo: 24 },
  { initials: "MK", name: "Marcus Kim",      room: "Room 312", minsAgo: 36 },
  { initials: "AL", name: "Aisha Langford",  room: "Room 507", minsAgo: 48 },
];

// ─── Booking List ─────────────────────────────────────────────────────────────

export const bookingList: BookingEntry[] = [
  {
    id: "#BK-1001",
    guest: "James Donovan",
    roomType: "Deluxe Suite",
    roomNumber: "204",
    duration: "3 nights",
    checkIn: "Jun 5, 2026",
    checkOut: "Jun 8, 2026",
    status: "Confirmed",
  },
  {
    id: "#BK-1002",
    guest: "Sofia Petrov",
    roomType: "Standard Room",
    roomNumber: "118",
    duration: "2 nights",
    checkIn: "Jun 6, 2026",
    checkOut: "Jun 8, 2026",
    status: "Checked In",
  },
  {
    id: "#BK-1003",
    guest: "Marcus Kim",
    roomType: "Junior Suite",
    roomNumber: "312",
    duration: "5 nights",
    checkIn: "Jun 4, 2026",
    checkOut: "Jun 9, 2026",
    status: "Confirmed",
  },
  {
    id: "#BK-1004",
    guest: "Aisha Langford",
    roomType: "Presidential Suite",
    roomNumber: "507",
    duration: "1 night",
    checkIn: "Jun 7, 2026",
    checkOut: "Jun 8, 2026",
    status: "Pending",
  },
  {
    id: "#BK-1005",
    guest: "Lucas Herrera",
    roomType: "Standard Room",
    roomNumber: "102",
    duration: "4 nights",
    checkIn: "Jun 3, 2026",
    checkOut: "Jun 7, 2026",
    status: "Cancelled",
  },
  {
    id: "#BK-1006",
    guest: "Elena Vasquez",
    roomType: "Ocean View",
    roomNumber: "415",
    duration: "7 nights",
    checkIn: "Jun 1, 2026",
    checkOut: "Jun 8, 2026",
    status: "Confirmed",
  },
];
