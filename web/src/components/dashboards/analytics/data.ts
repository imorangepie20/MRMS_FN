// ─── Traffic Overview (~12 data points, sessions over 28 days) ───────────────

export type SessionDataPoint = {
  day: string;
  sessions: number;
};

export const sessionData: SessionDataPoint[] = [
  { day: "May 1",  sessions: 820  },
  { day: "May 4",  sessions: 960  },
  { day: "May 7",  sessions: 740  },
  { day: "May 10", sessions: 1100 },
  { day: "May 13", sessions: 880  },
  { day: "May 16", sessions: 1050 },
  { day: "May 19", sessions: 790  },
  { day: "May 22", sessions: 1200 },
  { day: "May 25", sessions: 970  },
  { day: "May 28", sessions: 1080 },
  { day: "May 31", sessions: 920  },
  { day: "Jun 3",  sessions: 1342 },
];

// ─── Traffic Sources (Donut) ──────────────────────────────────────────────────

export type TrafficSource = {
  name: string;
  value: number;
  fill: string;
};

export const trafficSources: TrafficSource[] = [
  { name: "Direct",   value: 432, fill: "var(--chart-1)" },
  { name: "Organic",  value: 216, fill: "var(--chart-2)" },
  { name: "Referral", value: 180, fill: "var(--chart-3)" },
  { name: "Social",   value: 120, fill: "var(--chart-4)" },
];

// ─── Sales by Countries ───────────────────────────────────────────────────────

export type CountryRow = {
  flag: string;
  country: string;
  change: string;
  revenue: string;
  positive: boolean;
};

export const countrySales: CountryRow[] = [
  { flag: "🇺🇸", country: "United States", change: "+27.4%", revenue: "$68,420", positive: true  },
  { flag: "🇧🇷", country: "Brazil",         change: "+20.1%", revenue: "$34,180", positive: true  },
  { flag: "🇮🇳", country: "India",          change: "-5.0%",  revenue: "$21,540", positive: false },
  { flag: "🇦🇺", country: "Australia",      change: "+10.9%", revenue: "$15,760", positive: true  },
  { flag: "🇫🇷", country: "France",         change: "+2.1%",  revenue: "$11,320", positive: true  },
  { flag: "🇬🇷", country: "Greece",         change: "-0.1%",  revenue: "$6,890",  positive: false },
];

// ─── Monthly Campaign State ───────────────────────────────────────────────────

export type CampaignRow = {
  metric: string;
  count: string;
  change: string;
  positive: boolean;
};

export const campaignStats: CampaignRow[] = [
  { metric: "Opened",      count: "6,043", change: "+2.1%", positive: true  },
  { metric: "Clicked",     count: "600",   change: "-2.1%", positive: false },
  { metric: "Subscribe",   count: "490",   change: "+8.5%", positive: true  },
  { metric: "Complaints",  count: "490",   change: "+4.5%", positive: false },
  { metric: "Unsubscribe", count: "1,200", change: "-0.5%", positive: false },
];
