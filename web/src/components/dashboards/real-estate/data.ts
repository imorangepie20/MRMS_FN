// ─── Types ────────────────────────────────────────────────────────────────────

export type RevenueDataPoint = {
  label: string;
  revenue: number;
  visits: number;
};

export type Reminder = {
  title: string;
  date: string;
};

export type LeadAgent = {
  initials: string;
  name: string;
  location: string;
};

export type SalesDataPoint = {
  month: string;
  online: number;
  offline: number;
  agent: number;
  marketing: number;
};

export type PropertyStatus = "Active" | "Pending" | "Sold";

export type PropertyListing = {
  id: string;
  colorClass: string;
  name: string;
  location: string;
  type: string;
  cost: string;
  activeLeads: number;
  views: number;
  status: PropertyStatus;
};

export type CalendarAppointment = {
  title: string;
  date: string;
};

// ─── Revenue / Visit chart ────────────────────────────────────────────────────

export const revenueDataWeekly: RevenueDataPoint[] = [
  { label: "Mon", revenue: 1200000, visits: 320 },
  { label: "Tue", revenue: 1450000, visits: 410 },
  { label: "Wed", revenue: 1100000, visits: 280 },
  { label: "Thu", revenue: 1680000, visits: 490 },
  { label: "Fri", revenue: 1920000, visits: 560 },
  { label: "Sat", revenue: 2100000, visits: 620 },
  { label: "Sun", revenue: 1750000, visits: 480 },
];

export const revenueDataMonthly: RevenueDataPoint[] = [
  { label: "Jan", revenue: 6200000, visits: 1840 },
  { label: "Feb", revenue: 7400000, visits: 2100 },
  { label: "Mar", revenue: 8100000, visits: 2350 },
  { label: "Apr", revenue: 7800000, visits: 2200 },
  { label: "May", revenue: 9200000, visits: 2700 },
  { label: "Jun", revenue: 10500000, visits: 3100 },
  { label: "Jul", revenue: 11200000, visits: 3400 },
  { label: "Aug", revenue: 10800000, visits: 3250 },
  { label: "Sep", revenue: 9600000, visits: 2900 },
  { label: "Oct", revenue: 8900000, visits: 2650 },
  { label: "Nov", revenue: 8400000, visits: 2480 },
  { label: "Dec", revenue: 7100000, visits: 2100 },
];

export const revenueDataYearly: RevenueDataPoint[] = [
  { label: "2020", revenue: 62000000, visits: 18400 },
  { label: "2021", revenue: 71000000, visits: 21200 },
  { label: "2022", revenue: 78000000, visits: 24800 },
  { label: "2023", revenue: 84000000, visits: 27600 },
  { label: "2024", revenue: 91000000, visits: 31200 },
  { label: "2025", revenue: 96700000, visits: 34800 },
];

// ─── Reminders ────────────────────────────────────────────────────────────────

export const reminders: Reminder[] = [
  { title: "Property Inspection at Oak Street",    date: "Oct 8"  },
  { title: "Client Meeting — The Somerset",        date: "Oct 12" },
  { title: "Contract Signing for Maple Heights",   date: "Oct 17" },
];

// ─── Leads Contact ────────────────────────────────────────────────────────────

export const leadAgents: LeadAgent[] = [
  { initials: "JR", name: "James Rivera",    location: "New York, NY"  },
  { initials: "SC", name: "Sofia Chen",      location: "Los Angeles, CA" },
  { initials: "MK", name: "Marcus Kwon",     location: "Chicago, IL"   },
  { initials: "AP", name: "Aisha Patel",     location: "Houston, TX"   },
];

// ─── Sales Analytics ─────────────────────────────────────────────────────────

export const salesAnalyticsData: SalesDataPoint[] = [
  { month: "Jan", online: 42, offline: 28, agent: 56, marketing: 34 },
  { month: "Feb", online: 38, offline: 32, agent: 48, marketing: 29 },
  { month: "Mar", online: 55, offline: 25, agent: 62, marketing: 41 },
  { month: "Apr", online: 47, offline: 35, agent: 53, marketing: 38 },
  { month: "May", online: 63, offline: 22, agent: 71, marketing: 45 },
  { month: "Jun", online: 58, offline: 30, agent: 65, marketing: 52 },
];

// ─── Property Overview ────────────────────────────────────────────────────────

export const propertyOverviewData = [
  { name: "Listed", value: 860, fill: "var(--chart-1)" },
  { name: "Sold",   value: 463, fill: "var(--chart-2)" },
];

// ─── Active Listing Table ─────────────────────────────────────────────────────

export const activeListings: PropertyListing[] = [
  {
    id: "1",
    colorClass: "bg-violet-500",
    name: "Oak Street Residence",
    location: "Brooklyn, NY",
    type: "Residential",
    cost: "$1,250,000",
    activeLeads: 8,
    views: 342,
    status: "Active",
  },
  {
    id: "2",
    colorClass: "bg-blue-500",
    name: "The Somerset",
    location: "Manhattan, NY",
    type: "Luxury",
    cost: "$4,800,000",
    activeLeads: 14,
    views: 2048,
    status: "Active",
  },
  {
    id: "3",
    colorClass: "bg-amber-500",
    name: "Maple Heights",
    location: "Austin, TX",
    type: "Residential",
    cost: "$890,000",
    activeLeads: 5,
    views: 218,
    status: "Pending",
  },
  {
    id: "4",
    colorClass: "bg-emerald-500",
    name: "Riverside Lofts",
    location: "Chicago, IL",
    type: "Commercial",
    cost: "$2,100,000",
    activeLeads: 11,
    views: 580,
    status: "Active",
  },
  {
    id: "5",
    colorClass: "bg-rose-500",
    name: "Sunset Villa",
    location: "Miami, FL",
    type: "Luxury",
    cost: "$3,400,000",
    activeLeads: 9,
    views: 1124,
    status: "Pending",
  },
  {
    id: "6",
    colorClass: "bg-cyan-500",
    name: "Harbor View",
    location: "Seattle, WA",
    type: "Residential",
    cost: "$1,620,000",
    activeLeads: 6,
    views: 405,
    status: "Sold",
  },
  {
    id: "7",
    colorClass: "bg-orange-500",
    name: "Greenwood Estate",
    location: "Denver, CO",
    type: "Residential",
    cost: "$975,000",
    activeLeads: 4,
    views: 297,
    status: "Active",
  },
  {
    id: "8",
    colorClass: "bg-indigo-500",
    name: "Park Avenue Penthouse",
    location: "New York, NY",
    type: "Luxury",
    cost: "$6,200,000",
    activeLeads: 7,
    views: 890,
    status: "Sold",
  },
];

// ─── Calendar Appointments ────────────────────────────────────────────────────

export const calendarAppointments: CalendarAppointment[] = [
  { title: "Property Tour — Oak Street",    date: "Jun 12, 2025" },
  { title: "Follow-up Call — The Somerset", date: "Jun 18, 2025" },
  { title: "Client Walkthrough — Riverside", date: "Jun 25, 2025" },
];
