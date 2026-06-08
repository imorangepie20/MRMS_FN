// ─── Types ────────────────────────────────────────────────────────────────────

export type RevenueDataPoint = {
  month: string;
  desktop: number;
  mobile: number;
};

export type BestSellingProduct = {
  name: string;
  color: string;
  sold: number;
};

export type SalesOrder = {
  id: string;
  customer: string;
  qtyItems: number;
  amount: string;
  paymentMethod: string;
  status: "paid" | "pending" | "cancelled";
};

// ─── Revenue (Desktop vs Mobile, ~12 monthly points) ─────────────────────────
// Desktop total: 13,746 — Mobile total: 13,580
export const revenueData: RevenueDataPoint[] = [
  { month: "Jan", desktop: 1020, mobile: 980 },
  { month: "Feb", desktop: 1150, mobile: 1100 },
  { month: "Mar", desktop: 1200, mobile: 1180 },
  { month: "Apr", desktop: 1080, mobile: 1050 },
  { month: "May", desktop: 1300, mobile: 1280 },
  { month: "Jun", desktop: 1240, mobile: 1200 },
  { month: "Jul", desktop: 980,  mobile: 960  },
  { month: "Aug", desktop: 1100, mobile: 1080 },
  { month: "Sep", desktop: 1060, mobile: 1040 },
  { month: "Oct", desktop: 1196, mobile: 1180 },
  { month: "Nov", desktop: 1120, mobile: 1010 },
  { month: "Dec", desktop: 1300, mobile: 1520 },
];
// Desktop sum: 13,746 | Mobile sum: 13,580

// ─── Best Selling Products ────────────────────────────────────────────────────
export const bestSellingProducts: BestSellingProduct[] = [
  { name: "Sports Shoes",       color: "bg-violet-500",  sold: 316 },
  { name: "Black T-Shirt",      color: "bg-blue-500",    sold: 274 },
  { name: "Jeans",              color: "bg-cyan-500",    sold: 195 },
  { name: "Red Sneakers",       color: "bg-rose-500",    sold: 402 },
  { name: "Red Scarf",          color: "bg-red-400",     sold: 280 },
  { name: "Kitchen Accessory",  color: "bg-amber-500",   sold: 150 },
];

// ─── Sales Orders ─────────────────────────────────────────────────────────────
export const salesOrders: SalesOrder[] = [
  { id: "#S-1001", customer: "Olivia Martin",  qtyItems: 3, amount: "$142.00", paymentMethod: "Visa",       status: "paid"      },
  { id: "#S-1002", customer: "James Lee",      qtyItems: 1, amount: "$89.00",  paymentMethod: "Mastercard", status: "pending"   },
  { id: "#S-1003", customer: "Emma Wilson",    qtyItems: 2, amount: "$55.00",  paymentMethod: "PayPal",     status: "paid"      },
  { id: "#S-1004", customer: "Liam Brown",     qtyItems: 4, amount: "$310.00", paymentMethod: "Visa",       status: "cancelled" },
  { id: "#S-1005", customer: "Sophia Davis",   qtyItems: 1, amount: "$39.00",  paymentMethod: "Mastercard", status: "paid"      },
  { id: "#S-1006", customer: "Noah Martinez",  qtyItems: 2, amount: "$78.00",  paymentMethod: "PayPal",     status: "pending"   },
];
