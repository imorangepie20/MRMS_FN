// ─── Types ────────────────────────────────────────────────────────────────────

export type RevenueDataPoint = {
  month: string;
  desktop: number;
  mobile: number;
};

export type LocationDataPoint = {
  country: string;
  value: number;
  percent: number;
};

export type VisitSource = {
  name: string;
  value: number;
  fill: string;
};

export type ReviewBreakdown = {
  stars: number;
  count: number;
};

export type SampleReview = {
  name: string;
  initials: string;
  text: string;
};

export type Order = {
  id: string;
  customer: string;
  product: string;
  amount: string;
  status: "success" | "processing" | "failed";
};

export type BestSellingProduct = {
  name: string;
  color: string;
  price: string;
  sold: number;
};

// ─── Revenue (Desktop vs Mobile, ~12 months) ──────────────────────────────────
// Desktop total: 24,828 — Mobile total: 25,010
export const revenueData: RevenueDataPoint[] = [
  { month: "Jan", desktop: 1860, mobile: 1950 },
  { month: "Feb", desktop: 1940, mobile: 2100 },
  { month: "Mar", desktop: 2200, mobile: 2050 },
  { month: "Apr", desktop: 2100, mobile: 2200 },
  { month: "May", desktop: 2450, mobile: 2310 },
  { month: "Jun", desktop: 2300, mobile: 2400 },
  { month: "Jul", desktop: 1980, mobile: 1890 },
  { month: "Aug", desktop: 2050, mobile: 2150 },
  { month: "Sep", desktop: 1920, mobile: 1980 },
  { month: "Oct", desktop: 2078, mobile: 1980 },
  { month: "Nov", desktop: 1950, mobile: 2000 },
  { month: "Dec", desktop: 2000, mobile: 2000 },
];
// Desktop sum: 24828, Mobile sum: 25010

// ─── Sales by Location ────────────────────────────────────────────────────────
export const locationData: LocationDataPoint[] = [
  { country: "Canada", value: 85, percent: 85 },
  { country: "Greenland", value: 80, percent: 80 },
  { country: "Russia", value: 63, percent: 63 },
  { country: "China", value: 60, percent: 60 },
  { country: "Australia", value: 45, percent: 45 },
  { country: "Greece", value: 40, percent: 40 },
];

// ─── Store Visits by Source (donut) ───────────────────────────────────────────
export const visitSourceData: VisitSource[] = [
  { name: "Direct", value: 38, fill: "var(--chart-1)" },
  { name: "Social", value: 32, fill: "var(--chart-2)" },
  { name: "Email", value: 18, fill: "var(--chart-3)" },
  { name: "Referral", value: 12, fill: "var(--chart-4)" },
];

// ─── Customer Reviews ─────────────────────────────────────────────────────────
export const reviewBreakdown: ReviewBreakdown[] = [
  { stars: 5, count: 4000 },
  { stars: 4, count: 2100 },
  { stars: 3, count: 800 },
  { stars: 2, count: 631 },
  { stars: 1, count: 344 },
];

export const sampleReview: SampleReview = {
  name: "Alex Johnson",
  initials: "AJ",
  text: "Absolutely love this product — quality exceeded my expectations and delivery was super fast!",
};

// ─── Recent Orders ────────────────────────────────────────────────────────────
export const recentOrders: Order[] = [
  { id: "#3210", customer: "Olivia Martin", product: "Wireless Headphones", amount: "$142.00", status: "success" },
  { id: "#3211", customer: "James Lee", product: "Mechanical Keyboard", amount: "$89.00", status: "processing" },
  { id: "#3212", customer: "Emma Wilson", product: "USB-C Hub", amount: "$55.00", status: "success" },
  { id: "#3213", customer: "Liam Brown", product: "Webcam HD", amount: "$78.00", status: "failed" },
  { id: "#3214", customer: "Sophia Davis", product: "Monitor Stand", amount: "$39.00", status: "success" },
  { id: "#3215", customer: "Noah Martinez", product: "Laptop Sleeve", amount: "$29.00", status: "processing" },
  { id: "#3216", customer: "Isabella Clark", product: "Noise Cancelling Earbuds", amount: "$119.00", status: "success" },
  { id: "#3217", customer: "Ethan Taylor", product: "Portable Charger", amount: "$45.00", status: "failed" },
];

// ─── Best Selling Products ────────────────────────────────────────────────────
export const bestSellingProducts: BestSellingProduct[] = [
  { name: "Wireless Headphones", color: "bg-violet-500", price: "$142.00", sold: 1240 },
  { name: "Mechanical Keyboard", color: "bg-blue-500", price: "$89.00", sold: 980 },
  { name: "USB-C Hub", color: "bg-cyan-500", price: "$55.00", sold: 876 },
  { name: "Webcam HD", color: "bg-emerald-500", price: "$78.00", sold: 754 },
  { name: "Monitor Stand", color: "bg-amber-500", price: "$39.00", sold: 643 },
  { name: "Laptop Sleeve", color: "bg-orange-500", price: "$29.00", sold: 592 },
  { name: "Noise Cancelling Earbuds", color: "bg-rose-500", price: "$119.00", sold: 520 },
  { name: "Portable Charger", color: "bg-pink-500", price: "$45.00", sold: 418 },
];
